//go:build unix

package terminal

import "syscall"

// A pty master reports EIO once the child has exited. Linux and macOS differ
// on whether that arrives before or instead of EOF, so both are treated as the
// end of the stream.
var syscallEIO error = syscall.EIO
