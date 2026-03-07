# Secrets Management

This document describes how secrets and sensitive configuration are managed in the EcoSquad project.

## 🔐 GitHub Secrets and Variables

Configure these in: GitHub Repository → Settings → Secrets and variables → Actions

### Required Secrets

| Secret Name | Description | How to Obtain |
|-------------|-------------|---------------|
| `AWS_DEPLOY_ROLE_ARN` | IAM Role ARN for GitHub Actions deployment | Create an IAM role with GitHub OIDC trust policy |

### Required Variables (Repository Variables)

| Variable Name | Example Value | Description |
|---------------|---------------|-------------|
| `DEV_APP_URL` | `https://dev.eco-squad.com` | Development website URL |
| `DEV_API_URL` | `https://abc123.execute-api.eu-west-1.amazonaws.com/dev` | Development API Gateway URL |
| `DEV_CORS_ORIGIN` | `https://dev.eco-squad.com` | Allowed CORS origin for dev |
| `DEV_OAUTH_CALLBACK_URLS` | `https://dev.eco-squad.com/auth/callback` | OAuth callback URLs for dev |
| `DEV_OAUTH_LOGOUT_URLS` | `https://dev.eco-squad.com` | OAuth logout URLs for dev |
| `PROD_APP_URL` | `https://eco-squad.com` | Production website URL |
| `PROD_API_URL` | `https://xyz789.execute-api.eu-west-1.amazonaws.com/prod` | Production API Gateway URL |
| `PROD_CORS_ORIGIN` | `https://eco-squad.com` | Allowed CORS origin for prod |
| `PROD_OAUTH_CALLBACK_URLS` | `https://eco-squad.com/auth/callback` | OAuth callback URLs for prod |
| `PROD_OAUTH_LOGOUT_URLS` | `https://eco-squad.com` | OAuth logout URLs for prod |

## 🔑 AWS Credentials

### Local Development

For local development, AWS credentials should be:
1. Configured via AWS CLI: `aws configure`
2. Or set in `.env` file (never commit this file!)
3. Or use AWS SSO: `aws sso login`

### CI/CD (GitHub Actions)

We use **GitHub OIDC** (OpenID Connect) for secure, keyless authentication:

1. **No long-lived credentials** are stored in GitHub
2. GitHub Actions receives a short-lived token from AWS
3. Token is automatically rotated

### Setting Up GitHub OIDC

1. **Create OIDC Identity Provider** in AWS IAM:
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
   - Thumbprint: Automatically fetched

2. **Create IAM Role** for deployment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:SKTECHCONSULTING/eco-squad:*"
        }
      }
    }
  ]
}
```

3. **Attach the Deployer Policy** (`infra/iam/deployer-policy.json`)

4. **Copy the Role ARN** to GitHub Secret `AWS_DEPLOY_ROLE_ARN`

## 🔒 Environment Files

### `.env.example`
Template with all required variables (safe to commit).

### `.env.development`
Development environment template.

### `.env.production`
Production environment template (values filled after first deployment).

### `.env` (Local)
Your local environment file (NEVER commit this):
```bash
cp .env.development .env
# Edit with your credentials
```

`.env` is in `.gitignore` and will never be committed.

## 📱 Mobile App Secrets

### Android

Store sensitive data in `local.properties` (already gitignored):
```properties
MAPS_API_KEY=your_maps_api_key
RELEASE_STORE_PASSWORD=your_keystore_password
```

Or use environment variables in CI:
```bash
export MAPS_API_KEY="${{ secrets.MAPS_API_KEY }}"
```

### iOS

Use Xcode's configuration files or environment variables:
- Store API keys in `Config.plist` (not in repo)
- Or use `xcconfig` files with environment variables

## 🔄 Rotating Secrets

### AWS Access Keys

1. Create new access key in AWS IAM Console
2. Update your local `.env` file
3. Update GitHub Secrets if using long-lived credentials (not recommended)
4. Delete old access key after confirming new one works

### GitHub Token

If using Personal Access Tokens:
1. Generate new token with required scopes
2. Update in repository secrets
3. Update in any local scripts
4. Delete old token

## 🛡️ Security Best Practices

1. **Never commit secrets** to git (use `.gitignore`)
2. **Use OIDC** for CI/CD instead of long-lived credentials
3. **Rotate secrets** regularly (every 90 days recommended)
4. **Use least privilege** IAM policies
5. **Enable CloudTrail** to audit AWS API calls
6. **Use AWS Secrets Manager** for production secrets (optional)
7. **Scan for secrets** in commits using git-secrets or similar tools

## 🧪 Local Development Secrets

For local development with LocalStack/DynamoDB Local, you can use dummy values:

```env
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
AWS_REGION=eu-west-1
```

These work because LocalStack doesn't validate credentials.

## 🚨 Incident Response

If a secret is accidentally committed:

1. **Rotate the secret immediately**
2. **Remove from git history** (if recent):
   ```bash
   git filter-branch --force --index-filter \
   "git rm --cached --ignore-unmatch .env" \
   --prune-empty --tag-name-filter cat -- --all
   ```
3. **Force push** (if necessary): `git push origin --force`
4. **Audit** for any unauthorized access
5. **Notify** team members

## 📚 Additional Resources

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides)
- [GitHub OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
