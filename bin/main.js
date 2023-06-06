const cdk = require('@aws-cdk/core');
const { ChatAppStack } = require('../lib/chat-app-stack');

const app = new cdk.App();
new ChatAppStack(app, 'ChatAppStack');

// CDKアプリケーションの内容を解析・生成します。
app.synth();
