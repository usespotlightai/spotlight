package inject

import (
	"bytes"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strings"

	"usespotlight.ai/data-plane/protocol"
	"usespotlight.ai/data-plane/reach"
)

type swap struct {
	injected []byte
	standIn  []byte
}

var escapedByte = regexp.MustCompile(`%[0-9A-F]{2}`)

func lowerHex(text string) string {
	return escapedByte.ReplaceAllStringFunc(text, strings.ToLower)
}

func inJSON(text string) string {
	var written bytes.Buffer
	encoder := json.NewEncoder(&written)
	encoder.SetEscapeHTML(false)
	if encoder.Encode(text) != nil {
		return text
	}
	quoted := strings.TrimSuffix(written.String(), "\n")

	return quoted[1 : len(quoted)-1]
}

var spellings = []func(string) string{
	func(text string) string { return text },
	inJSON,
	func(text string) string { return strings.ReplaceAll(inJSON(text), "/", `\/`) },
	url.QueryEscape,
	url.PathEscape,
	func(text string) string { return lowerHex(url.QueryEscape(text)) },
	func(text string) string { return lowerHex(url.PathEscape(text)) },
}

func (w *injected) swaps() []swap {
	standIn := protocol.StandInPrefix + w.secret
	pairs := [][2]string{{string(w.value), w.prefix + standIn}, {string(w.bare), standIn}}

	var swaps []swap
	for _, pair := range pairs {
		for _, spelled := range spellings {
			value := spelled(pair[0])
			if value == "" || slices.ContainsFunc(swaps, func(each swap) bool { return string(each.injected) == value }) {
				continue
			}
			swaps = append(swaps, swap{injected: []byte(value), standIn: []byte(spelled(pair[1]))})
		}
	}

	return swaps
}

var echoedIn = []string{"Location", "Content-Location", "Link", "Refresh"}

func textual(contentType string) bool {
	kind, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return false
	}

	return strings.HasPrefix(kind, "text/") ||
		strings.HasSuffix(kind, "+json") || strings.HasSuffix(kind, "+xml") ||
		slices.Contains([]string{"application/json", "application/xml", "application/x-www-form-urlencoded"}, kind)
}

func (w *Injector) Redact(host string, response *http.Response) {
	w.mu.RLock()
	var swaps []swap
	for _, each := range w.byHost[reach.Normal(host)] {
		swaps = append(swaps, each.swaps()...)
	}
	w.mu.RUnlock()

	if len(swaps) == 0 {
		return
	}
	slices.SortStableFunc(swaps, func(one, other swap) int { return len(other.injected) - len(one.injected) })

	for _, name := range echoedIn {
		values := response.Header.Values(name)
		for at, value := range values {
			values[at] = string(swapped([]byte(value), swaps))
		}
	}

	encoding := response.Header.Get("Content-Encoding")
	bodiless := response.StatusCode == http.StatusNotModified || response.StatusCode == http.StatusNoContent ||
		(response.Request != nil && response.Request.Method == http.MethodHead)
	if bodiless || response.Body == nil || !textual(response.Header.Get("Content-Type")) || (encoding != "" && encoding != "identity") {
		return
	}

	response.Body = &redactingReader{from: response.Body, swaps: swaps}
	response.ContentLength = -1
	response.Header.Del("Content-Length")
}

func swapped(text []byte, swaps []swap) []byte {
	var out bytes.Buffer
	for at := 0; at < len(text); {
		if each, found := matching(text[at:], swaps); found {
			out.Write(each.standIn)
			at += len(each.injected)
			continue
		}
		out.WriteByte(text[at])
		at++
	}

	return out.Bytes()
}

func matching(text []byte, swaps []swap) (swap, bool) {
	for _, each := range swaps {
		if bytes.HasPrefix(text, each.injected) {
			return each, true
		}
	}

	return swap{}, false
}

func startsOne(text []byte, swaps []swap) bool {
	return slices.ContainsFunc(swaps, func(each swap) bool {
		return len(text) < len(each.injected) && bytes.HasPrefix(each.injected, text)
	})
}

type redactingReader struct {
	from    io.ReadCloser
	chunk   []byte
	swaps   []swap
	pending []byte
	out     bytes.Buffer
	ended   bool
}

func (u *redactingReader) Read(into []byte) (int, error) {
	if u.chunk == nil {
		u.chunk = make([]byte, 32*1024)
	}

	for u.out.Len() == 0 {
		if u.ended {
			if len(u.pending) == 0 {
				return 0, io.EOF
			}
			u.out.Write(swapped(u.pending, u.swaps))
			u.pending = nil
			continue
		}

		read, err := u.from.Read(u.chunk)
		u.pending = append(u.pending, u.chunk[:read]...)
		switch {
		case err == io.EOF:
			u.ended = true
		case err != nil:
			return 0, err
		}
		u.settle()
	}

	return u.out.Read(into)
}

func (u *redactingReader) settle() {
	at := 0
	for at < len(u.pending) {
		if each, found := matching(u.pending[at:], u.swaps); found {
			u.out.Write(each.standIn)
			at += len(each.injected)
			continue
		}
		if startsOne(u.pending[at:], u.swaps) {
			break
		}
		u.out.WriteByte(u.pending[at])
		at++
	}

	u.pending = append([]byte(nil), u.pending[at:]...)
}

func (u *redactingReader) Close() error {
	return u.from.Close()
}
