# Security Policy

## Supported Versions

Only the latest version of **Multi-Translation** is supported for security updates. 

## Reporting a Vulnerability

If you discover a potential security vulnerability in this project, please **do not open a public issue**. Instead, follow the standard responsible disclosure practice:

1.  **Preparation**: Gather all relevant information about the vulnerability (steps to reproduce, impact, affected parts).
2.  **Disclosure**: Report the issue directly to the maintainer via the contact information provided in the repository profile or through GitHub's private vulnerability reporting feature if enabled.
3.  **Correction**: After receiving your report, the maintainer will evaluate and work on a fix as quickly as possible.
4.  **Publishing**: A fix will be released, and then the vulnerability will be publicly disclosed if necessary.

## Best Practices for Users

### API Key Security
- **NEVER** hardcode your `GEMINI_API_KEY` in the source code.
- Always use environment variables (`.env` file).
- The `.env` file is included in `.gitignore` by default to prevent accidental leaks.
- If you accidentally push your API Key to a public repository, **revoke it immediately** in the [Google AI Studio Secrets panel](https://aistudio.google.com/app/apikey).

### Deployment
- When deploying to production (e.g., Vercel, Netlify, Cloud Run), configure the `GEMINI_API_KEY` as a secret environment variable in the platform's dashboard, never in the git repository.
