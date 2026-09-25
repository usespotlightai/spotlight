package acp

import (
	"encoding/json"
	"strconv"
	"sync"
)

var writing sync.Mutex

func (c *Client) write(message any) error {
	encoded, err := json.Marshal(message)
	if err != nil {
		return err
	}

	writing.Lock()
	defer writing.Unlock()

	_, err = c.stdin.Write(append(encoded, '\n'))
	return err
}

func rawID(id int) *json.RawMessage {
	raw := json.RawMessage(strconv.Itoa(id))
	return &raw
}

func idOf(raw json.RawMessage) (int, bool) {
	at, err := strconv.Atoi(string(raw))
	if err != nil {
		return 0, false
	}
	return at, true
}

func mustRaw(result any) json.RawMessage {
	if raw, ok := result.(json.RawMessage); ok {
		return raw
	}
	return json.RawMessage("null")
}
