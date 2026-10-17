package control_test

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"usespotlight.ai/data-plane/protocol"
)

type clientError interface {
	ClientErrorMessage() (string, bool)
}

func TestHistoryAsksForTheStationWithEscapedFilters(t *testing.T) {
	var path, query, auth string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		path, query, auth = r.URL.EscapedPath(), r.URL.RawQuery, r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"runs":[]}`))
	})

	answer, err := client.History(context.Background(), "run/1", protocol.HistoryRequest{
		Station: "implementation", Line: "delivery & ops", Fingerprint: "abc",
		Outcome: "failed", Since: "2026-09-01T00:00:00+02:00", Last: 30,
	})
	if err != nil {
		t.Fatalf("history: %v", err)
	}

	if path != "/api/runs/run%2F1/history" {
		t.Errorf("path %q", path)
	}
	if query != "fingerprint=abc&last=30&line=delivery+%26+ops&outcome=failed&since=2026-09-01T00%3A00%3A00%2B02%3A00&station=implementation" {
		t.Errorf("query %q", query)
	}
	if auth != "Bearer tok" {
		t.Errorf("authorization %q", auth)
	}
	if strings.TrimSpace(string(answer)) != `{"runs":[]}` {
		t.Errorf("answer %s, want what came back whole", answer)
	}
}

func TestHistoryLeavesOutFiltersThatWereNotGiven(t *testing.T) {
	var query string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.RawQuery
		_, _ = w.Write([]byte(`{}`))
	})

	if _, err := client.History(context.Background(), "run_1", protocol.HistoryRequest{Station: "review"}); err != nil {
		t.Fatalf("history: %v", err)
	}

	if query != "station=review" {
		t.Errorf("query %q", query)
	}
}

func TestHistoryCarriesTheReasonSeveralLinesHaveTheStation(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"statusCode":409,"message":"Several lines have a station by that key; name one with --line: a, b"}`))
	})

	_, err := client.History(context.Background(), "run_1", protocol.HistoryRequest{Station: "review"})

	var rejected clientError
	if !errors.As(err, &rejected) {
		t.Fatalf("err = %v, want a client error", err)
	}
	if because, ok := rejected.ClientErrorMessage(); !ok || !strings.Contains(because, "name one with --line") {
		t.Errorf("rejected because %q", because)
	}
}

func TestHistorySaysWhichStationWasNotFound(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"statusCode":404,"message":"Not Found"}`))
	})

	_, err := client.History(context.Background(), "run_1", protocol.HistoryRequest{Station: "reviw", Line: "delivery"})

	var rejected clientError
	if !errors.As(err, &rejected) {
		t.Fatalf("err = %v, want a client error", err)
	}
	if because, _ := rejected.ClientErrorMessage(); because != `line "delivery" has no station "reviw" in this team` {
		t.Errorf("rejected because %q", because)
	}
}
