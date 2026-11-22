package protocol

const (
	AgentAPIURLVar   = "SPOTLIGHT_AGENT_API_URL"
	AgentAPITokenVar = "SPOTLIGHT_AGENT_API_TOKEN"
)

const (
	AgentAPIToolsPath              = "/tools/"
	AgentAPIReviewCommentReplyPath = "/review-comment-replies"
	AgentAPITracePath              = "/trace"
	AgentAPIRecallPath             = "/recall"
	AgentAPIRememberPath           = "/remember"
	AgentAPIForgetPath             = "/forget"
	AgentAPITouchedPath            = "/touched"
	AgentAPIHistoryPath            = "/history"
	AgentAPICandidatePath          = "/candidates"
	AgentAPICausePath              = "/causes"
	AgentAPISubmitPath             = "/submit"
	AgentAPIDecisionPath           = "/decisions"
)

const (
	HandoverReview = "review"
	HandoverDone   = "done"
)

const (
	MaxHandoverFiles     = 10
	MaxHandoverFileBytes = 25 * 1024 * 1024
	MaxHandoverBodyBytes = MaxHandoverFiles*MaxHandoverFileBytes*4/3 + 1024*1024
)
