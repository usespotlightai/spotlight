# Changelog

## 0.1.0 (2026-10-23)


### ⚠ BREAKING CHANGES

* Rename token trusts to OIDC trusts, and show them beside tokens on one API access page ([#352](https://github.com/usespotlightai/spotlight/issues/352))

### Features

* Configure a host with spotlight host init and config, in place of env prefixes and sed ([#342](https://github.com/usespotlightai/spotlight/issues/342)) ([cbf827a](https://github.com/usespotlightai/spotlight/commit/cbf827a723410487b0bef84af049fdeff700fef0))
* Export Terraform as one file per concern, and find references in every file of the module ([#348](https://github.com/usespotlightai/spotlight/issues/348)) ([5221d56](https://github.com/usespotlightai/spotlight/commit/5221d568fd9e848307e098e99fdee07fe17886ab))
* Install spotlight without a host, and check for a container runtime when spotlight host init starts ([#356](https://github.com/usespotlightai/spotlight/issues/356)) ([3db906a](https://github.com/usespotlightai/spotlight/commit/3db906a18d5d52f73c6bb0edfd5cc1b447e5fe32))
* Install the binaries of a staging build from the canary release ([#322](https://github.com/usespotlightai/spotlight/issues/322)) ([a93e629](https://github.com/usespotlightai/spotlight/commit/a93e629b78d273bf29cf461fb2151e86c597dddb))
* Log in from the command line with spotlight login, so the CLI and Terraform act as you ([#349](https://github.com/usespotlightai/spotlight/issues/349)) ([9cafb09](https://github.com/usespotlightai/spotlight/commit/9cafb0939dd7f894c62d43d936c8ce8a4bf96492))
* Rename token trusts to OIDC trusts, and show them beside tokens on one API access page ([#352](https://github.com/usespotlightai/spotlight/issues/352)) ([ccd02b8](https://github.com/usespotlightai/spotlight/commit/ccd02b8c48c7dadbe52a0efc586af853d73997df))
* Show each trace's runs and filter traces like runs, in place of the Insights Runs tab ([#353](https://github.com/usespotlightai/spotlight/issues/353)) ([44bafa8](https://github.com/usespotlightai/spotlight/commit/44bafa88dbdd0865ca2129f3829fc78f99fa2a51))


### Bug Fixes

* Compare host and runner releases as semver versions ([7eae538](https://github.com/usespotlightai/spotlight/commit/7eae538bc0f8059e00f67b0103c07b3fb3c77060))
* Compare host and runner releases as semver versions ([064e473](https://github.com/usespotlightai/spotlight/commit/064e473ccc264952a042f58cb028a2ce9666f88d))
* Install canary when the Spotlight that serves the script is not a release ([#334](https://github.com/usespotlightai/spotlight/issues/334)) ([0df56cd](https://github.com/usespotlightai/spotlight/commit/0df56cd1490ad025426db324a4b5d63172bc53aa))
* Install gh in the runner image, and pin the Spotlight provider version in the exported Terraform ([#347](https://github.com/usespotlightai/spotlight/issues/347)) ([8b04ec2](https://github.com/usespotlightai/spotlight/commit/8b04ec297a7b47eb67b2dd0f99f31f7c3f002a02))
* Install latest, canary or a release, and stop on any other version ([#332](https://github.com/usespotlightai/spotlight/issues/332)) ([7c9a570](https://github.com/usespotlightai/spotlight/commit/7c9a570138a04bbd94ffc31c2e17e20ac5991703))
* Keep only the release name in a Release so it orders the same after an event payload ([a370558](https://github.com/usespotlightai/spotlight/commit/a370558b5b9b20cdc24eec6e87a094762ae63b7f))
* Let spotlight host update canary install the canary build when its checksum passes ([#346](https://github.com/usespotlightai/spotlight/issues/346)) ([431d524](https://github.com/usespotlightai/spotlight/commit/431d52414b0252bc8bddaa1c323225f3ff243e0e))
* Model a published release as a Release value object ([a10ef3a](https://github.com/usespotlightai/spotlight/commit/a10ef3aa6687b53fb1c57f4126f61aa82ec14cc2))
* **SPO-254:** Show every message at the station on a run page and open it at the run ([#337](https://github.com/usespotlightai/spotlight/issues/337)) ([39ff987](https://github.com/usespotlightai/spotlight/commit/39ff9879e777de29385c034680c20af92076a036))
* **SPO-255:** Follow the newest run at the station on a run page, and send and stop at once ([#338](https://github.com/usespotlightai/spotlight/issues/338)) ([ee74e2e](https://github.com/usespotlightai/spotlight/commit/ee74e2ebe20295ae60e2c7e118279f41c50127c7))
* **SPO-256:** Match a run's thread by station id, so a rename or a same-named station does not break it ([#339](https://github.com/usespotlightai/spotlight/issues/339)) ([ef57b3d](https://github.com/usespotlightai/spotlight/commit/ef57b3d04ba7c368923c56436c345d9808cd6fa7))
* **SPO-257:** Let run messages arrive smoothly, show the agent's answer, and say when a run is queued ([#340](https://github.com/usespotlightai/spotlight/issues/340)) ([8c5ce8a](https://github.com/usespotlightai/spotlight/commit/8c5ce8a722d80780fbd36d2a4873e7ffcdea0833))
* **SPO-258:** Show a run's progress, queued or in progress, the same on every page ([#343](https://github.com/usespotlightai/spotlight/issues/343)) ([6192550](https://github.com/usespotlightai/spotlight/commit/6192550eca1f336277218599a6e901fc9db005ec))
* **SPO-259:** Show that a run is stopping, and send what a run does as one activity ([#345](https://github.com/usespotlightai/spotlight/issues/345)) ([045b7c2](https://github.com/usespotlightai/spotlight/commit/045b7c24effbbb4fa0185d7f53de8ee47a3f666d))
* Stop a search as station-gone when its station leaves before its next iteration is queued ([#329](https://github.com/usespotlightai/spotlight/issues/329)) ([0eaea5c](https://github.com/usespotlightai/spotlight/commit/0eaea5cd67ec791031465a3b05834d1928480fbb))
* Stop dropdown menus from animating their width, so a submenu no longer bounces when you pick a model ([#351](https://github.com/usespotlightai/spotlight/issues/351)) ([09b1add](https://github.com/usespotlightai/spotlight/commit/09b1addd04ce1eca1bb7d8de5bd1caf2e623173e))
