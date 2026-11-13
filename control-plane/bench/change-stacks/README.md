# Change stack benchmark

Drafts change stacks for a fixed set of real diffs and measures how well each stack divides the change. It calls the same `GenerateChangeStack` service, diff reader, symbol indexer and model client as production. It uses no database and runs no checks.

## Run it

```bash
npm run bench:change-stacks -- run --env ../.env --label baseline
```

- `--repeats <n>` drafts each case n times (default 3). The model is not deterministic, so one draft per case is not enough.
- `--cases pr-540,pr-530` runs only those cases.
- `--model <id>` replaces `CHANGE_STACK_MODEL` / `LLM_MODEL`. The default is staging's model.
- `--concurrency <n>` drafts n stacks at once (default 4).

The model endpoint comes from `LLM_BASE_URL`, `LLM_API_KEY` (or `OPENROUTER_API_KEY`) and `LLM_SUPPORTS_REASONING_EFFORT`, as in the control plane. The default endpoint is OpenRouter.

Each run writes `results/<label>-<time>.json`, and the model drafts of each sample in `results/<label>-<time>.drafts.json`. The folder is not in git.

## Compare two runs

```bash
npm run bench:change-stacks -- compare results/baseline-….json results/split-hunks-….json
npm run bench:change-stacks -- show results/split-hunks-….json pr-540
```

`show` prints the layers of each draft of one case, with their size.

## Recheck drafts without the model

```bash
npm run bench:change-stacks -- recheck results/split-hunks-….json --verbose
```

`recheck` checks the recorded drafts of a run again with the current code and calls no model. It counts the drafts that the code refused when they were drafted, the drafts it refuses now, and the reasons. Use it to test a change to the checks or the repairs at no cost.

## The corpus

`corpus.json` lists squash-merged pull requests of this repository by commit. The benchmark diffs each commit the way the runner diffs a checkout (`git diff -M --unified=100000`). A case can name a `patch` file instead of a `commit`, for example a diff copied from a staging stack.

Size buckets count the changed lines of the hunks the model places: small below 300, medium below 1,500, large from 1,500. Lockfiles, generated files and other set-aside hunks do not count.

## The measures

Only layers of `change` cohorts count. Lines are added plus removed lines.

| Measure              | Meaning                                                                           | Better |
| -------------------- | --------------------------------------------------------------------------------- | ------ |
| ready                | Drafts that became a ready stack                                                  | Higher |
| biggest layer        | The largest layer's share of the reviewed lines                                   | Lower  |
| effective layers     | (Σ lines)² / Σ lines², the number of equal layers that would give the same spread | Higher |
| over 400 lines       | Layers with more than 400 changed lines                                           | Lower  |
| floor (biggest hunk) | The largest hunk's share of the placed lines. No layer can be smaller than this   | Lower  |
| cost / ready         | What all drafts cost, divided by the ready stacks. A failed draft costs too       | Lower  |

A cost is the cost the endpoint reports. Otherwise the benchmark prices the tokens from the models.dev catalog (`LLM_PRICES_URL`), the same way the control plane does. A model the catalog does not know is unpriced, and the run says how many calls had no price.

A case reports the median of its drafts, and a bucket reports the mean of its cases. When "biggest layer" is close to "floor", the hunks limit the stack, not the model.

These measures show size and spread only. They do not show whether the layers are in a good order or whether each layer builds.
