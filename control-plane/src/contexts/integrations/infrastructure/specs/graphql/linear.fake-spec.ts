export const LINEAR_SDL = `
"""An issue."""
type Issue {
  id: ID!
  identifier: String!
  title: String!
  priority: Float
  state: WorkflowState!
  team: Team!
  comments(first: Int): CommentConnection!
  children(filter: IssueFilter!): IssueConnection!
}

type WorkflowState {
  id: ID!
  name: String!
  type: String!
  color(format: String! = "hex"): String
}

type Team {
  id: ID!
  key: String!
  name: String!
  issues(first: Int): IssueConnection!
}

type Comment {
  id: ID!
  body: String!
}

type CommentConnection {
  nodes: [Comment!]!
}

type IssueConnection {
  nodes: [Issue!]!
}

enum IssueSort {
  createdAt
  updatedAt
}

input IssueFilter {
  title: StringComparator
  and: [IssueFilter!]
}

input StringComparator {
  eq: String
  contains: String
}

input IssueCreateInput {
  title: String!
  teamId: String!
  description: String
  priority: Int = 0
  labelIds: [String!]
}

type IssuePayload {
  success: Boolean!
  issue: Issue
}

scalar JSONObject

type Query {
  """Find one issue by its id."""
  issue(id: String!): Issue!
  issues(filter: IssueFilter, first: Int = 50, sort: IssueSort): IssueConnection!
  viewer: Team!
}

type Mutation {
  """Create an issue."""
  issueCreate(input: IssueCreateInput!): IssuePayload!
  issueArchive(id: String!, trash: Boolean): IssuePayload!
  webhookCreate(input: JSONObject!): Boolean!
}
`;
