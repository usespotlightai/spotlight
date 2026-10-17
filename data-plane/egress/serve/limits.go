package serve

import (
	"fmt"
	"sync"
	"time"
)

type limits struct {
	rate float64
	most int
	now  func() time.Time

	mu      sync.Mutex
	buckets map[string]*bucket
}

type bucket struct {
	tokens float64
	at     time.Time
	open   int
}

func newLimits(rate float64, most int, now func() time.Time) *limits {
	return &limits{rate: rate, most: most, now: now, buckets: map[string]*bucket{}}
}

func (l *limits) take(workspace string) (func(), string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	found, ok := l.buckets[workspace]
	if !ok {
		found = &bucket{tokens: l.burst(), at: now}
		l.buckets[workspace] = found
	}

	if l.rate > 0 {
		found.tokens = min(l.burst(), found.tokens+now.Sub(found.at).Seconds()*l.rate)
		found.at = now
		if found.tokens < 1 {
			return nil, fmt.Sprintf(
				"Sorry, this workspace sends more than %g requests each second through egress. Please send fewer requests.", l.rate)
		}
	}
	if l.most > 0 && found.open >= l.most {
		return nil, fmt.Sprintf(
			"Sorry, this workspace has more than %d connections open through egress. Please close some connections.", l.most)
	}

	if l.rate > 0 {
		found.tokens--
	}
	found.open++

	var once sync.Once
	return func() {
		once.Do(func() {
			l.mu.Lock()
			defer l.mu.Unlock()
			found.open--
		})
	}, ""
}

func (l *limits) burst() float64 {
	return max(1, l.rate)
}

func (l *limits) sweep() {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	for workspace, found := range l.buckets {
		if found.open == 0 && found.tokens+now.Sub(found.at).Seconds()*l.rate >= l.burst() {
			delete(l.buckets, workspace)
		}
	}
}
