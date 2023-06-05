// 必要なモジュールをインポートします。これらのモジュールはAWS CDKの一部で、AWSの各種サービスを操作するためのものです。
const cdk = require('@aws-cdk/core');  // AWS CDKの基本的なクラスや関数を提供するモジュール
const appsync = require('@aws-cdk/aws-appsync');  // AWS AppSyncを操作するためのモジュール
const dynamodb = require('@aws-cdk/aws-dynamodb');  // AWS DynamoDBを操作するためのモジュール
const cognito = require('@aws-cdk/aws-cognito');  // AWS Cognitoを操作するためのモジュール
const s3 = require('@aws-cdk/aws-s3');  // AWS S3を操作するためのモジュール
const cloudfront = require('@aws-cdk/aws-cloudfront');  // AWS CloudFrontを操作するためのモジュール
const s3deploy = require('@aws-cdk/aws-s3-deployment');  // S3へのデプロイを操作するためのモジュール
const iam = require('@aws-cdk/aws-iam');  // AWS IAMを操作するためのモジュール
const origins = require('@aws-cdk/aws-cloudfront-origins');  // CloudFrontのオリジンを操作するためのモジュール
const { v4: uuidv4 } = require('uuid');  // UUIDを生成するためのモジュール

// AWS CDKにおけるStackの定義。Stackは、AWSリソースの集まりを表現するためのもので、このクラスのインスタンスがAWSのインフラストラクチャを構築します。
class ChatAppStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Amazon S3バケットを作成します
    // これはウェブサイトをホストするためのバケットで、静的ウェブホスティングが有効になっています
    const bucket = new s3.Bucket(this, 'ChatBucket', {
      publicReadAccess: false,  // バケットに公開読み取りアクセスを許可しません
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      websiteIndexDocument: 'index.html',  // バケットのウェブサイトのインデックスドキュメント（通常のウェブサイトで言うところのホームページ）を設定します
      websiteErrorDocument: 'error.html',  // エラーページとして表示するドキュメントを設定します
      removalPolicy: cdk.RemovalPolicy.DESTROY,  // デモのためにバケットが削除される際に中のオブジェクトも一緒に削除します
    });

    // Amazon S3バケットにReactコードをデプロイします
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./web/build')],
      destinationBucket: bucket
    });

    // Amazon CloudFrontディストリビューションを作成します
    // これはS3バケットの内容を全世界に配信するためのものです
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI');
    const distribution = new cloudfront.Distribution(this, 'ChatDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(bucket, { // 配信する内容のオリジン（元）を設定します。ここでは先ほど作成したS3バケットを指定しています
          originAccessIdentity: originAccessIdentity,  // 追加: OAIの設定
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,  // HTTPでアクセスしてきたビューア（ユーザー）をHTTPSにリダイレクトします
      },
    });

    // S3バケットのポリシーを設定します
    // ここでは全てのユーザー（"*"）に対してバケット内の全てのオブジェクトへの読み取り（"s3:GetObject"）を許可しています
    const bucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject'],
      principals: [new iam.AnyPrincipal()],  // 全てのプリンシパルを許可します
      resources: [bucket.arnForObjects('*')],  // バケット内の全てのオブジェクトを指定します
    });
    bucket.addToResourcePolicy(bucketPolicy);  // 作成したポリシーをバケットに追加します

    // Cognito User Poolの定義（ユーザ登録と認証を行うサービス）
    const userPool = new cognito.UserPool(this, 'ChatAppUserPool', {
      selfSignUpEnabled: true,  // 自己登録を可能にする
      autoVerify: { email: true },  // Eメールによる自動認証を行う
    });

    // User Poolクライアントの設定
    // このクライアント設定を使用することで、ユーザーがサインアップやサインインを行うことができます
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      oAuth: {
        callbackUrls: ['http://localhost:3000', 'https://' + distribution.distributionDomainName],
        logoutUrls: ['http://localhost:3000', 'https://' + distribution.distributionDomainName],
      },
    });

    // User Poolのドメイン設定を作成します
    // ドメイン名にはランダムなUUIDを付けて一意にします
    const userPoolDomain = new cognito.UserPoolDomain(this, 'Domain', {
      userPool,
      cognitoDomain: {
        domainPrefix: `chat-app-${uuidv4()}`,
      },
    });

    // DynamoDBテーブルの定義（チャットデータを格納するデータベース）
    const chatTable = new dynamodb.Table(this, 'ChatTable', {
      partitionKey: { name: 'MessageID', type: dynamodb.AttributeType.STRING },  // パーティションキー（主キー）をUserIDとする
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,  // ペイパーリクエスト（オンデマンド）モードにする
      removalPolicy: cdk.RemovalPolicy.DESTROY,  // スタックの削除とともにテーブルも削除する
    });

    // AppSync APIの定義（クライアントとサーバの間を仲介するサービス）
    const chatAPI = new appsync.GraphqlApi(this, 'ChatAPI', {
      name: 'chatAPI',  // APIの名前
      schema: appsync.Schema.fromAsset('graphql/schema.graphql'),  // スキーマ定義ファイルを指定
      authorizationConfig: {
        defaultAuthorization: {  // デフォルトの認証方法をUser Poolにする
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool,  // 上で定義したUser Poolを使用する
          },
        },
        additionalAuthorizationModes: [],  // 追加の認証方法はなし
      },
      xrayEnabled: true,  // X-Rayを有効にする（APIのパフォーマンスを監視・トレースするためのサービス）
    });

    // AppSyncのDataSourceを定義（APIがデータを操作するためのデータソース）
    const chatDataSource = chatAPI.addDynamoDbDataSource('chatDataSource', chatTable);

    // メッセージ取得のリゾルバーを定義
    chatDataSource.createResolver({
      typeName: 'Query',  // メッセージ取得はクエリ操作として定義
      fieldName: 'getMessage',  // フィールド名を設定
      // リクエストマッピングテンプレート（DynamoDBへのクエリを定義するVTLスクリプト）を指定
      requestMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/getMessage.req.vtl'),
      // レスポンスマッピングテンプレート（DynamoDBからのレスポンスを加工するVTLスクリプト）を指定
      responseMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/getMessage.res.vtl'),
    });

    // メッセージ送信のリゾルバーを定義
    chatDataSource.createResolver({
      typeName: 'Mutation',  // メッセージ送信はミューテーション操作として定義
      fieldName: 'sendMessage',  // フィールド名を設定
      requestMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/sendMessage.req.vtl'),
      responseMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/sendMessage.res.vtl'),
    });

    // メッセージ編集のリゾルバーを定義
    chatDataSource.createResolver({
      typeName: 'Mutation',  // メッセージ編集はミューテーション操作として定義
      fieldName: 'editMessage',  // フィールド名を設定
      requestMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/editMessage.req.vtl'),
      responseMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/editMessage.res.vtl'),
    });

    // メッセージ削除のリゾルバーを定義
    chatDataSource.createResolver({
      typeName: 'Mutation',  // メッセージ削除はミューテーション操作として定義
      fieldName: 'deleteMessage',  // フィールド名を設定
      requestMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/deleteMessage.req.vtl'),
      responseMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/deleteMessage.res.vtl'),
    });

    // メッセージ送信時のサブスクリプションリゾルバーを定義
    chatDataSource.createResolver({
      typeName: 'Subscription',
      fieldName: 'messageSent',
      requestMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/getMessage.req.vtl'),
      responseMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/getMessage.res.vtl'),
    });

    // メッセージ編集時のサブスクリプションリゾルバーを定義
    chatDataSource.createResolver({
      typeName: 'Subscription',
      fieldName: 'messageEdited',
      requestMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/getMessage.req.vtl'),
      responseMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/getMessage.res.vtl'),
    });

    // メッセージ削除時のサブスクリプションリゾルバーを定義
    chatDataSource.createResolver({
      typeName: 'Subscription',
      fieldName: 'messageDeleted',
      requestMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/getMessage.req.vtl'),
      responseMappingTemplate: appsync.MappingTemplate.fromFile('resolvers/getMessage.res.vtl'),
    });

    // CloudFrontのドメイン名を出力します
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: 'https://' + distribution.distributionDomainName,
    });

    // User Pool Domainを出力します
    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: `${userPoolDomain.domainName}.auth.${cdk.Stack.of(this).region}.amazoncognito.com`,
    });

    // User Pool Idを出力します
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    // User Pool Web Client Idを出力します
    new cdk.CfnOutput(this, 'UserPoolWebClientId', {
      value: userPoolClient.userPoolClientId,
    });

    // AppSyncのエンドポイントを出力します
    new cdk.CfnOutput(this, 'GraphQLEndpoint', {
      value: chatAPI.graphqlUrl,
    });
  }
}

module.exports = { ChatAppStack };  // ChatAppStackをエクスポートして他のモジュールから利用可能にする
