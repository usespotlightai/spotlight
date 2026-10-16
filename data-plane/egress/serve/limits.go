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
	held, ok := l.buckets[workspace]
	if !ok {
		held = &bucket{tokens: l.burst(), at: now}
		l.buckets[workspace] = held
	}

	if l.rate > 0 {
		held.tokens = min(l.burst(), held.tokens+now.Sub(held.at).Seconds()*l.rate)
		held.at = now
		if held.tokens < 1 {
			return nil, fmt.Sprintf(
				"Sorry, this workspace sends more than %g requests each second through egress. Please send fewer requests.", l.rate)
		}
	}
	if l.most > 0 && held.open >= l.most {
		return nil, fmt.Sprintf(
			"Sorry, this workspace has more than %d connections open through egress. Please close some connections.", l.most)
	}

	if l.rate > 0 {
		held.tokens--
	}
	held.open++

	var once sync.Once
	return func() {
		once.Do(func() {
			l.mu.Lock()
			defer l.mu.Unlock()
			held.open--
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
	for workspace, held := range l.buckets {
		if held.open == 0 && held.tokens+now.Sub(held.at).Seconds()*l.rate >= l.burst() {
			delete(l.buckets, workspace)
		}
	}
}
