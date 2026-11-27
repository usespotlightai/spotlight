# The Spotlight provider release that the Terraform export requires.
# Dependabot opens a pull request when the registry has a newer one.
terraform {
  required_providers {
    spotlight = {
      source  = "usespotlightai/spotlight"
      version = "0.1.0-rc.11"
    }
  }
}
