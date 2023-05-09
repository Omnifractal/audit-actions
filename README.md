# Initiate Omnifractal Audits Actions

Use GitHub Actions to run Omnifractal audits.

# How it works

This GitHub action runs Omnifractal audits for a list of given page IDs with their project's API key.

Additionally, you can provide this action with a Lighthouse budget file, as well as git-related information such as the branch, repository, commit SHA, commit message, commit author, and commit author email.

## Inputs

| Input                | Description                                                  | Required |
|----------------------|--------------------------------------------------------------|----------|
| `pages`              | A list of page IDs to audit                                  | Yes      |
| `apiKey`             | Project API key for authorization                            | Yes      |
| `waitForResults`     | Wait for audits to finish                                    | No       |
| `timeout`            | How long to wait for audits to finish, in seconds            | No       |
| `budgetsPath`        | Path to the Lighthouse budget file                           | No       |
| `branch`             | Branch name                                                  | No       |
| `repository`         | Repository name                                              | No       |
| `commit_sha`         | Commit SHA                                                   | No       |
| `commit_message`     | Commit message                                               | No       |
| `commit_author`      | Commit author                                                | No       |
| `commit_author_email`| Commit author email                                          | No       |

## Usage

To use this action in your GitHub workflow, add the following steps to your workflow file:

```yaml
steps:
  - uses: actions/checkout@v3 # Checkout your code to the GitHub Actions runner
  - name: Run audits of Page 1 and Page 2
    uses: omnifractal/audit-actions@main
    with:
      pages:
        pageid1
        pageid2
      apiKey: ${{ secrets.OMNIFRACTAL_PROJECT_API_KEY }}
      waitForResults: true
      timeout: 300 # 5 minutes, a default value
      budgetsPath: '.github/omnifractal/budgets.json' # example of a budgets file path
      branch: ${{ github.ref }}
      repository: ${{ github.repository }}
      commit_sha: ${{ github.sha }}
      commit_message: ${{ github.event.head_commit.message }}
      commit_author: ${{ github.event.head_commit.author.name }}
      commit_author_email: ${{ github.event.head_commit.author.email }}
```

The `actions/checkout@v3` action is necessary for the workflow to check out your code to the GitHub Actions runner. This allows the action to access your repository's files, including the Lighthouse budget file if specified.

In order to audit pages from different projects, you'll need to add multiple steps of this action with different API keys.

If you want to specify budgets, create a `budgets.json` file in your repository and add the path to the `budgetsPath` input. Example of a budgets file:

```json
[
  {
    "path": "/*",
    "timings": [
      {
        "metric": "interactive",
        "budget": 5000
      },
      {
        "metric": "first-meaningful-paint",
        "budget": 2000
      }
    ],
    "resourceSizes": [
      {
        "resourceType": "total",
        "budget": 500
      },
      {
        "resourceType": "script",
        "budget": 150
      }
    ],
    "resourceCounts": [
      {
        "resourceType": "third-party",
        "budget": 100
      }
    ]
  }
]
```

You can learn more about budgets configuration in [official Lighthouse documentation](https://github.com/GoogleChrome/lighthouse/blob/main/docs/performance-budgets.md).
