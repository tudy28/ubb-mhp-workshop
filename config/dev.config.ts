import {DrClCdkConfig} from "./config";

export class DevConfig implements DrClCdkConfig {
    readonly environment = "dev" as const;
    // TODO(workshop): replace with YOUR Cognito user pool ID (Cognito console -> User pools -> Overview)
    readonly cognito_user_pool_id = "<YOUR_COGNITO_USER_POOL_ID>";
}