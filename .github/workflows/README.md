# GitHub Actions Workflows

## trmnlp-pull.yml

This workflow automates the process of running `trmnlp pull` on all TRMNL plugins in the repository.

### Triggers

- **Manual**: Can be triggered manually via workflow_dispatch
- **Scheduled**: Runs daily at 00:00 UTC

### Required Secrets

- `TRMNL_API_KEY`: Your TRMNL API key required for the trmnlp tool

### What it does

1. **Setup Docker**: Installs Docker Buildx for running containers
2. **Branch Management**:
   - Checks if a branch named `trmnlp-pull-updates` exists
   - If it exists, checks it out
   - If not, creates a new branch with that name
3. **Process Plugins**:
   - Finds all directories containing `.trmnlp.yml` files
   - For each directory, runs:
     ```bash
     docker run --rm \
       --volume "$(pwd):/plugin" \
       --env TRMNL_API_KEY="${TRMNL_API_KEY}" \
       trmnl/trmnlp pull -f
     ```
4. **Commit Changes**:
   - Checks if any files were modified
   - If no changes, the workflow exits
   - If changes exist, commits all modified files
5. **Push and PR**:
   - Pushes the branch to origin
   - If this is a new branch (not previously associated with a PR), creates a new Pull Request

### Notes

- The workflow will only create a PR once. Subsequent runs will push to the existing branch without creating new PRs.
- The PR will be created against the `master` branch.
- All commits are made by `github-actions[bot]`.
