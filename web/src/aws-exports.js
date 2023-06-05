const awsconfig = {
    Auth: {
        region: 'ap-northeast-1',
        userPoolId: '【UserPoolId】',
        userPoolWebClientId: '【UserPoolWebClientId】',
        oauth: {
            domain: '【UserPoolDomain】',
            scope: ['openid'],
            redirectSignIn: '【CloudFrontURL】',
            redirectSignOut: '【CloudFrontURL】',
            responseType: 'code'
        }
    },
    aws_appsync_graphqlEndpoint: '【GraphQLEndpoint】',
    aws_appsync_region: 'ap-northeast-1',
    aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
    aws_appsync_apiKey: "null"
};

export default awsconfig;