package dashboard

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
)

// paused runs a command that owns the terminal, then waits for Enter, so its output stays to read.
type paused struct {
	cmd   *exec.Cmd
	shown string
}

func (p paused) SetStdin(in io.Reader)    { p.cmd.Stdin = in }
func (p paused) SetStdout(out io.Writer)  { p.cmd.Stdout = out }
func (p paused) SetStderr(errs io.Writer) { p.cmd.Stderr = errs }

const clearScreen = "\033[H\033[2J"

func (p paused) Run() error {
	if p.cmd.Stdout != nil {
		fmt.Fprintf(p.cmd.Stdout, "%s$ %s\n\n", clearScreen, p.shown)
	}
	err := p.cmd.Run()
	if p.cmd.Stdout != nil {
		fmt.Fprint(p.cmd.Stdout, "\nPress Enter to go back to spotlight.")
	}
	if p.cmd.Stdin != nil {
		_, _ = bufio.NewReader(p.cmd.Stdin).ReadString('\n')
	}
	return err
}
