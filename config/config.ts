export interface DrClCdkConfig {
    readonly environment: "dev" | "stage" | "prod";
    /** ID of the Cognito user pool that protects the API, e.g. eu-west-1_AbCdEf123.
     *  The pool must live in the same account and region as DropboxCloneStack. */
    readonly cognito_user_pool_id: string;
    readonly hosted_zone_id?: string;
    readonly hosted_zone_name?: string;
    readonly domain_certificate_arn?: string;
    readonly frontend_domain_name?: string;
}