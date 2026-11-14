/**
 * Workshop settings - replace every <...> placeholder with the values of YOUR deployment.
 * See the "Configure the frontend" section in the root README.md.
 */
export const APP_SETTINGS = {
  /** Output "ApiUrl" of DropboxCloneStack, WITHOUT trailing slash, e.g. https://abc123.execute-api.eu-west-1.amazonaws.com/prod */
  apiUrl: '<YOUR_API_URL>',

  /** Output "FrontendUrl" of frontend-stack-drcl-dev, e.g. https://d1234abcd.cloudfront.net */
  frontendUrl: '<YOUR_CLOUDFRONT_URL>',

  /** Region of the Cognito user pool */
  cognitoRegion: 'eu-west-1',

  /** Cognito -> User pools -> Overview -> "User pool ID", e.g. eu-west-1_AbCdEf123 */
  cognitoUserPoolId: '<YOUR_COGNITO_USER_POOL_ID>',

  /** Cognito -> User pools -> App clients -> "Client ID" */
  cognitoClientId: '<YOUR_COGNITO_APP_CLIENT_ID>',
};
