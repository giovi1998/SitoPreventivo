# Block-DangerousGit.ps1
# PowerShell version of git guardrails for Windows/OpenCode
# Reads JSON from stdin and blocks dangerous git commands

param(
    [Parameter(ValueFromPipeline=$true)]
    [string]$InputJson
)

begin {
    $DANGEROUS_PATTERNS = @(
        "git push"
        "git reset --hard"
        "git clean -fd"
        "git clean -f"
        "git branch -D"
        "git checkout \."
        "git restore \."
        "push --force"
        "reset --hard"
        "git stash drop"
        "git tag -d"
    )
}

process {
    try {
        $json = $Input | ConvertFrom-Json
        $command = $json.tool_input.command

        foreach ($pattern in $DANGEROUS_PATTERNS) {
            if ($command -match $pattern) {
                Write-Error "BLOCKED: '$command' matches dangerous pattern '$pattern'. The user has prevented you from doing this."
                exit 2
            }
        }

        exit 0
    }
    catch {
        Write-Error "Error parsing input: $_"
        exit 1
    }
}
