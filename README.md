# Dropbox-like File Sharing on AWS (CDK Workshop)

A serverless file-sharing app, defined entirely with the **AWS CDK (TypeScript)**:

- **Backend** (`DropboxCloneStack`, your default region, `eu-west-1`): API Gateway REST API with a Cognito authorizer, a Lambda function (Node.js 24) in a VPC, an S3 bucket for files, and a DynamoDB table for metadata.
- **Frontend** (`frontend-stack-drcl-dev`, always `us-east-1`): an Angular app served from a KMS-encrypted S3 bucket through CloudFront.
- **HelloWorldStack**: a minimal Lambda, to show the smallest possible CDK stack.

The point of the workshop: one `cdk deploy` creates about 50 resources (VPC, subnets, endpoints, IAM roles, KMS keys, buckets, policies, API, CloudFront, ...). The **Cognito user pool is created by hand in the console** so you can compare the two approaches.

---

## Workshop guide

> Every student uses **their own AWS account**. Follow the steps in order. All values you have to fill in are marked with `<...>` placeholders, and there are only **two files** to edit:
>
> | File | What goes in it | When |
> |---|---|---|
> | `config/dev.config.ts` | Cognito user pool ID | Step 3 |
> | `frontend/dropboxclone/src/app/app-settings.ts` | API URL, CloudFront URL, user pool ID, app client ID | Step 6 |

### 0. Prerequisites

- **Node.js 24** (`nvm use` reads `.nvmrc`)
- **AWS CLI v2** (`aws --version`)
- An AWS account and a user with admin permissions (IAM user or IAM Identity Center)
- The CloudFront distribution only allows visitors from **Romania and Germany** (`geoRestriction` in `lib/frontend/distribution.ts`). Change it if needed.

```bash
git clone <this-repo-url>
cd ubb-mhp-workshop
nvm use
npm install
(cd lambda/upload-handler && npm install && npm run build)   # CDK deploys the prebuilt lambda/upload-handler/dist
(cd frontend/dropboxclone && npm install)
```

> Re-run `npm run build` in `lambda/upload-handler` every time you change the Lambda code.

### 1. Configure AWS credentials

**Option A: IAM user with access keys**
```bash
aws configure
#   AWS Access Key ID:     <from IAM -> Users -> you -> Security credentials -> Create access key>
#   AWS Secret Access Key: <...>
#   Default region name:   eu-west-1
#   Default output format: json
```

**Option B: IAM Identity Center (SSO)**
```bash
aws configure sso
#   SSO start URL:          https://<your-id>.awsapps.com/start
#   SSO region:             <region where Identity Center is enabled, NOT necessarily eu-west-1>
#   SSO registration scopes: (press Enter)
#   -> log in in the browser, pick account + role
#   Default client Region:  eu-west-1
#   Profile name:           workshop
export AWS_PROFILE=workshop
```

Check it works and note your **account ID**:
```bash
aws sts get-caller-identity
aws configure get region      # must print eu-west-1
```

### 2. Create the Cognito user pool (manually, in the console)

1. Open the AWS console and switch the region (top right) to **Europe (Ireland) eu-west-1**. The pool **must** be in the same account and region as the backend.
2. Go to **Amazon Cognito → User pools → Create user pool**.
   - Application type: **Single-page application (SPA)** (a public client without a secret)
   - Name your application, e.g. `drcl-web-client`
   - Sign-in identifiers: **Email**
   - Return URL: `http://localhost:4200` (you add the CloudFront URL in step 5)
3. Open the new pool and write down:
   - **User pool ID** (Overview), e.g. `eu-west-1_AbCdEf123`
   - **App client ID** (App clients → your client), e.g. `1a2b3c4d5e6f7g8h9i0jklmnop`
4. In **App clients → your client → Login pages → Edit**, check:
   - OAuth grant type: **Authorization code grant**
   - OpenID Connect scopes: **openid, email, phone**
5. Under **Users → Create user**, create a user for yourself (email + temporary password).

CLI alternative for looking up the IDs:
```bash
aws cognito-idp list-user-pools --max-results 20 --region eu-west-1 --output table
aws cognito-idp list-user-pool-clients --user-pool-id <POOL_ID> --region eu-west-1 --output table
```

### 3. Point the backend at your user pool

Edit **`config/dev.config.ts`**:
```ts
readonly cognito_user_pool_id = "eu-west-1_AbCdEf123";   // your User pool ID
```
The stack builds the pool ARN from the account and region it is deployed to, so you don't need to enter the account ID. `cdk synth`/`deploy` fail with a clear error while the placeholder is still there.

### 4. Bootstrap and deploy

Bootstrap once per account and region. The frontend lives in `us-east-1` because CloudFront certificates must be there:
```bash
npx cdk bootstrap aws://<ACCOUNT_ID>/eu-west-1 aws://<ACCOUNT_ID>/us-east-1
```

Deploy everything (about 5–10 minutes, mostly CloudFront):
```bash
npx cdk deploy --all
```

Write down these **outputs** from the deploy:

| Stack | Output | Used in |
|---|---|---|
| `DropboxCloneStack` | `ApiUrl` | step 6 |
| `frontend-stack-drcl-dev` | `FrontendUrl` | steps 5 and 6 |
| `frontend-stack-drcl-dev` | `DeploymentBucketName`, `DeploymentBucketKmsKeyArn`, `DistributionId` | step 7 |

To see them again later:
```bash
aws cloudformation describe-stacks --stack-name DropboxCloneStack --region eu-west-1 --query 'Stacks[0].Outputs' --output table
aws cloudformation describe-stacks --stack-name frontend-stack-drcl-dev --region us-east-1 --query 'Stacks[0].Outputs' --output table
```

### 5. Allow the CloudFront URL in Cognito

Cognito → your pool → **App clients → your client → Login pages → Edit**. Add the `FrontendUrl` (e.g. `https://d1234abcd.cloudfront.net`, **without a trailing slash**) to both:
- **Allowed callback URLs**
- **Allowed sign-out URLs**

Keep `http://localhost:4200` as well, for local development.

### 6. Configure the frontend

Edit **`frontend/dropboxclone/src/app/app-settings.ts`**:
```ts
export const APP_SETTINGS = {
  apiUrl: 'https://abc123.execute-api.eu-west-1.amazonaws.com/prod',  // ApiUrl output
  frontendUrl: 'https://d1234abcd.cloudfront.net',                    // FrontendUrl output
  cognitoRegion: 'eu-west-1',
  cognitoUserPoolId: 'eu-west-1_AbCdEf123',                           // step 2
  cognitoClientId: '1a2b3c4d5e6f7g8h9i0jklmnop',                       // step 2
};
```

### 7. Build and upload the frontend

```bash
cd frontend/dropboxclone
npm run build

aws s3 sync dist/dropboxclone/browser s3://<DeploymentBucketName> --delete \
  --sse aws:kms --sse-kms-key-id <DeploymentBucketKmsKeyArn>

aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
```

> The `--sse` flags are **required**. The bucket policy rejects uploads that are not KMS-encrypted, and CloudFront can only read objects encrypted with the stack's own key (not the default `aws/s3` key).

To try the app locally instead, run `npm start` and open `http://localhost:4200`.

### 8. Test

Open the `FrontendUrl` in a private browser window. You are sent to the Cognito login. Log in, set a new password the first time, then upload a file and check that it appears in the list.

Without a token the API should return `401`:
```bash
curl -i "<ApiUrl>/upload?uploadedBy=test@example.com"
```

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `cdk deploy`: *"The requested bucket name is not available"* | S3 bucket names are global. The frontend bucket names already include your account ID. If you still collide, change the names in `lib/frontend/*.ts`. |
| `cdk deploy`: *"has not been bootstrapped"* / *"SSM parameter /cdk-bootstrap/... not found"* | Run the bootstrap command for **both** `eu-west-1` and `us-east-1`. |
| `aws configure sso`: *InvalidRequestException ... RegisterClient* | Wrong **SSO region**. Use the region where IAM Identity Center is enabled (see the access portal → *Access keys*). |
| `aws configure sso`: *No AWS accounts are available to you* | Your SSO user has no account assignment. An admin must assign you a permission set in IAM Identity Center. |
| CloudFront shows an **AccessDenied XML** page | The files weren't uploaded with `--sse aws:kms --sse-kms-key-id <DeploymentBucketKmsKeyArn>`, or `index.html` isn't at the bucket root. Re-run the `sync` command from step 7. |
| CloudFront shows a 403 **HTML** page | Geo restriction: you're not in RO/DE (VPN?). |
| Cognito error page with `client_id=<YOUR_...>` or `invalid_request` | `app-settings.ts` still has placeholders, or you didn't rebuild and upload after editing it. Check with `grep -o 'clientId:"[^"]*"' dist/dropboxclone/browser/main-*.js`. |
| Cognito `redirect_mismatch` | The `FrontendUrl` isn't in the app client's callback URLs, or has a trailing slash (step 5). |
| API returns **401** after login | `cognito_user_pool_id` in `config/dev.config.ts` doesn't match the pool you log in with, or you didn't redeploy `DropboxCloneStack` after changing it. As a last resort: `aws apigateway create-deployment --rest-api-id <api-id> --stage-name prod --region eu-west-1`. |
| API returns **500/502** | Check the Lambda logs in CloudWatch: `/aws/lambda/DropboxCloneStack-FileUploadHandler...` |

---

## Lambda API Contract

All endpoints are secured with an Amazon Cognito user pool authorizer backed by the user pool you configure in `config/dev.config.ts`. Clients must send a valid **ID token** issued by that pool in the `Authorization: Bearer <JWT>` header.

`POST /upload` (default inline upload)
`POST /upload?multipart=true` (generate a pre-signed multipart/form-data upload)

Request body (JSON):

```json
{
  "fileName": "report.pdf",
  "fileContent": "<base64-encoded file bytes>",
  "uploadedBy": "alice@example.com",
  "contentType": "application/pdf",         // optional
  "expirationSeconds": 3600                  // optional, defaults to 3600 seconds
}
```

Response body (JSON):

```json
{
  "fileId": "<generated uuid>",
  "s3Path": "uploads/<uuid>/report.pdf",
  "url": "<pre-signed download url>",
  "urlExpiration": "2024-05-15T12:34:56.000Z"
}
```

When `multipart=true` is passed as a query parameter the Lambda will skip the inline upload. Instead, it returns a pre-signed POST URL that can be used to upload the file directly to S3 using `multipart/form-data`. In this mode the `fileContent` field is not required.

```json
{
  "fileName": "report.pdf",
  "uploadedBy": "alice@example.com",
  "contentType": "application/pdf",
  "expirationSeconds": 3600
}
```

The response additionally includes the data needed to complete the browser upload:

```json
{
  "fileId": "<generated uuid>",
  "s3Path": "uploads/<uuid>/report.pdf",
  "upload": {
    "url": "<pre-signed POST endpoint>",
    "fields": {
      "Content-Type": "application/pdf",
      "key": "uploads/<uuid>/report.pdf",
      "policy": "...",
      "x-amz-algorithm": "...",
      "x-amz-credential": "...",
      "x-amz-date": "...",
      "x-amz-signature": "..."
    },
    "expiresIn": 3600
  },
  "url": "<pre-signed download url>",
  "urlExpiration": "2024-05-15T12:34:56.000Z"
}
```

`GET /upload?uploadedBy=<email>`

Query string parameters:

- `uploadedBy` (required): The user identifier or email address used when uploading files. The Lambda queries DynamoDB using this value and only returns items owned by that user.

Response body (JSON):

```json
{
  "items": [
    {
      "fileId": "<uuid>",
      "fileName": "report.pdf",
      "uploadedBy": "alice@example.com",
      "uploadedDate": "2024-05-15T12:00:00.000Z",
      "s3Path": "uploads/<uuid>/report.pdf",
      "url": "<pre-signed download url>",
      "urlExpiration": "2024-05-15T13:00:00.000Z",
      "urlExpirationEpoch": 1715778000,
      "uploadMode": "inline"
    }
  ]
}
```

## Project Structure

- `bin/dropbox-clone.ts`: CDK app entry point; wires up the three stacks.
- `config/`: per-environment CDK settings (`dev.config.ts` holds the Cognito user pool ID).
- `lib/dropbox-clone-stack.ts`: backend (VPC, S3, DynamoDB, Lambda, API Gateway + Cognito authorizer).
- `lib/frontend/`: frontend hosting (S3 + KMS + CloudFront with Origin Access Control).
- `lib/hello-world-stack.ts`: minimal example stack.
- `lambda/upload-handler/`: Lambda source; `npm run build` bundles it into `dist/` with esbuild.
- `frontend/dropboxclone/`: Angular app; all deployment-specific values are in `src/app/app-settings.ts`.

## Clean Up

```bash
npx cdk destroy --all
```

Some things are **not** deleted automatically:
- The files bucket and the DynamoDB table of `DropboxCloneStack` use a `RETAIN` removal policy. Empty and delete them manually (S3 and DynamoDB consoles).
- The Cognito user pool: you created it by hand, so delete it by hand.
- The CDK bootstrap stacks (`CDKToolkit`) in `eu-west-1` and `us-east-1`. Delete them in CloudFormation if you no longer use CDK in that account.
