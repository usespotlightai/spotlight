package terminal_test

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"usespotlight.ai/runner/internal/protocol"
	"usespotlight.ai/runner/internal/terminal"
)

// drain reads until the child is gone, the only way to know a pty is finished.
// These tests use a real process because the kernel's behaviour is what is
// being checked.
func drain(t *testing.T, session *terminal.Session) string {
	t.Helper()

	var seen strings.Builder
	buffer := make([]byte, 1024)

	for {
		chunk, err := session.Read(buffer)
		seen.Write(chunk.Data)
		if err != nil {
			if !errors.Is(err, io.EOF) {
				t.Fatalf("read: %v", err)
			}
			return seen.String()
		}
	}
}

func start(t *testing.T, spec protocol.Command) (*terminal.Session, string) {
	t.Helper()

	dir := t.TempDir()
	recording := filepath.Join(dir, "recording")

	session, err := terminal.Start(context.Background(), terminal.Spec{
		Command:   spec,
		Dir:       dir,
		Recording: recording,
		Size:      terminal.DefaultSize,
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = session.Close() })

	return session, recording
}

func TestStartRunsTheCommandAndReportsItsOutput(t *testing.T) {
	session, _ := start(t, protocol.Command{
		Executable: "sh",
		Args:       []string{"-c", "echo hello from the agent"},
	})

	if out := drain(t, session); !strings.Contains(out, "hello from the agent") {
		t.Errorf("output %q", out)
	}
	if code := session.Wait(); code != 0 {
		t.Errorf("exit code %d", code)
	}
}

func TestOutputIsRecordedWithItsOffsets(t *testing.T) {
	session, recording := start(t, protocol.Command{
		Executable: "sh",
		Args:       []string{"-c", "echo one; echo two"},
	})

	var offsets []int64
	buffer := make([]byte, 8)
	for {
		chunk, err := session.Read(buffer)
		if len(chunk.Data) > 0 {
			offsets = append(offsets, chunk.Offset)
		}
		if err != nil {
			break
		}
	}
	session.Wait()

	if len(offsets) == 0 || offsets[0] != 0 {
		t.Fatalf("offsets %v", offsets)
	}
	for i := 1; i < len(offsets); i++ {
		if offsets[i] <= offsets[i-1] {
			t.Errorf("offsets went backwards: %v", offsets)
			break
		}
	}

	written, err := os.ReadFile(recording)
	if err != nil {
		t.Fatalf("read recording: %v", err)
	}
	if !strings.Contains(string(written), "one") || !strings.Contains(string(written), "two") {
		t.Errorf("recording %q", written)
	}
}

func TestTheAgentReadsWhatIsTypedAtIt(t *testing.T) {
	session, _ := start(t, protocol.Command{
		Executable: "sh",
		Args:       []string{"-c", "read line; echo got:$line"},
	})

	if err := session.Write([]byte("typed\n")); err != nil {
		t.Fatalf("write: %v", err)
	}

	if out := drain(t, session); !strings.Contains(out, "got:typed") {
		t.Errorf("output %q", out)
	}
}

func TestTheAgentIsToldTheTerminalSize(t *testing.T) {
	session, _ := start(t, protocol.Command{
		Executable: "sh",
		Args:       []string{"-c", "sleep 0.2; stty size"},
	})

	if err := session.Resize(terminal.Size{Cols: 100, Rows: 30}); err != nil {
		t.Fatalf("resize: %v", err)
	}

	if out := drain(t, session); !strings.Contains(out, "30 100") {
		t.Errorf("stty reported %q", out)
	}
}

func TestAFailingAgentReportsItsCode(t *testing.T) {
	session, _ := start(t, protocol.Command{
		Executable: "sh",
		Args:       []string{"-c", "exit 3"},
	})

	drain(t, session)

	if code := session.Wait(); code != 3 {
		t.Errorf("exit code %d, want 3", code)
	}
}

func TestCancellingTheContextStopsTheAgent(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	dir := t.TempDir()

	session, err := terminal.Start(ctx, terminal.Spec{
		Command:   protocol.Command{Executable: "sh", Args: []string{"-c", "sleep 30"}},
		Dir:       dir,
		Recording: filepath.Join(dir, "recording"),
		Size:      terminal.DefaultSize,
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = session.Close() })

	cancel()

	stopped := make(chan int, 1)
	go func() { stopped <- session.Wait() }()

	select {
	case <-stopped:
	case <-time.After(5 * time.Second):
		t.Fatal("the agent outlived its context")
	}
}

func TestTheAgentNeverSeesTheRunnersOwnSecrets(t *testing.T) {
	t.Setenv("SPOTLIGHT_TOKEN", "the-runners-control-plane-token")
	t.Setenv("SPOTLIGHT_URL", "https://spotlight.test")
	t.Setenv("HOME", os.Getenv("HOME"))

	session, _ := start(t, protocol.Command{Executable: "sh", Args: []string{"-c", "env"}})

	out := drain(t, session)
	session.Wait()

	if strings.Contains(out, "the-runners-control-plane-token") {
		t.Error("the agent can read the runner's control plane token")
	}
	if strings.Contains(out, "SPOTLIGHT_") {
		t.Errorf("the agent inherited runner configuration:\n%s", out)
	}
	if !strings.Contains(out, "TERM=xterm-256color") {
		t.Error("the agent should still be told what terminal it has")
	}
}

func TestTheAgentRunsAsSomebodyElseWhenAsked(t *testing.T) {
	if os.Getuid() != 0 {
		t.Skip("dropping to another user needs root")
	}

	as, err := terminal.LookupUser("agent")
	if err != nil {
		t.Skipf("no agent account here: %v", err)
	}

	// Not t.TempDir(): its parent is 0700 and root-owned, so the agent could
	// not traverse into it. Same trap the workspace root has to avoid.
	dir, err := os.MkdirTemp("", "agent-cwd")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	if err := os.Chown(dir, int(as.UID), int(as.GID)); err != nil {
		t.Fatal(err)
	}

	session, err := terminal.Start(context.Background(), terminal.Spec{
		Command:   protocol.Command{Executable: "sh", Args: []string{"-c", "id -u"}},
		Dir:       dir,
		Recording: filepath.Join(t.TempDir(), "recording"),
		Size:      terminal.DefaultSize,
		RunAs:     as,
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	t.Cleanup(func() { _ = session.Close() })

	out := drain(t, session)
	session.Wait()

	if !strings.Contains(out, "2000") {
		t.Errorf("the agent ran as %q, not the agent account", strings.TrimSpace(out))
	}
}

func TestLookupUserRefusesWhatItCannotDo(t *testing.T) {
	if os.Getuid() == 0 {
		t.Skip("an unprivileged runner is the case under test")
	}

	if _, err := terminal.LookupUser("agent"); err == nil {
		t.Error("an unprivileged runner should refuse to promise another user")
	}
}

func TestNoAgentUserRunsAsTheRunner(t *testing.T) {
	as, err := terminal.LookupUser("")
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if as != nil {
		t.Errorf("expected no user, got %+v", as)
	}
}
