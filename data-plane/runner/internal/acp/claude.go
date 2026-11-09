package acp

import (
	"encoding/json"
	"strings"

	"usespotlight.ai/data-plane/protocol"
)

const claudeCodeFrame = "_claude/sdkMessage"

func claudeCodeWork(params json.RawMessage) workChange {
	var frame struct {
		Message struct {
			Type    string `json:"type"`
			Subtype string `json:"subtype"`
			State   string `json:"state"`
			Tasks   []struct {
				TaskID      string `json:"task_id"`
				TaskType    string `json:"task_type"`
				Description string `json:"description"`
				Ambient     bool   `json:"ambient"`
			} `json:"tasks"`
		} `json:"message"`
	}
	if json.Unmarshal(params, &frame) != nil || frame.Message.Type != "system" {
		return workChange{}
	}

	switch frame.Message.Subtype {
	case "session_state_changed":
		busy := frame.Message.State != "idle"
		return workChange{reported: true, busy: &busy}
	case "background_tasks_changed":
		tasks := []protocol.BackgroundTask{}
		for _, task := range frame.Message.Tasks {
			if task.Ambient {
				continue
			}
			tasks = append(tasks, protocol.BackgroundTask{
				ID:          task.TaskID,
				Kind:        claudeCodeKind(task.TaskType),
				Description: task.Description,
			})
		}
		return workChange{reported: true, tasks: &tasks}
	default:
		return workChange{}
	}
}

func claudeCodeKind(taskType string) protocol.BackgroundKind {
	switch {
	case strings.Contains(taskType, "monitor"):
		return protocol.BackgroundMonitor
	case strings.HasSuffix(taskType, "_bash"):
		return protocol.BackgroundCommand
	case strings.HasSuffix(taskType, "_agent"):
		return protocol.BackgroundSubagent
	default:
		return protocol.BackgroundOther
	}
}
