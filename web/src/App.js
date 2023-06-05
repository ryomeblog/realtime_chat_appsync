import React, { useEffect, useState } from 'react';
import { Auth, API, graphqlOperation } from 'aws-amplify';
import { getMessage } from './graphql/queries';
import { messageSent, messageEdited, messageDeleted } from './graphql/subscriptions';
import { sendMessage, editMessage, deleteMessage } from './graphql/mutations';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");

  useEffect(() => {
    // ログインチェック
    Auth.currentAuthenticatedUser()
      .then(user => {
        setIsAuthenticated(true);
        // メッセージを取得
        fetchMessages();
      })
      .catch(err => {
        setIsAuthenticated(false);
        // Auth.federatedSignIn();  // サインイン画面にリダイレクト
      });

    // 新しいメッセージを購読
    const subscriptionCreate = API.graphql(
      graphqlOperation(messageSent)
    ).subscribe({
      next: ({ provider, value }) => {
        console.log('value', value);
        console.log('provider', provider);
        fetchMessages();
      },
      error: error => console.warn(error)
    });

    // メッセージの更新を購読
    const subscriptionUpdate = API.graphql(
      graphqlOperation(messageEdited)
    ).subscribe({
      next: ({ provider, value }) => fetchMessages(),
      error: error => console.warn(error)
    });

    // メッセージの削除を購読
    const subscriptionDelete = API.graphql(
      graphqlOperation(messageDeleted)
    ).subscribe({
      next: ({ provider, value }) => fetchMessages(),
      error: error => console.warn(error)
    });

    // クリーンアップ処理
    return () => {
      subscriptionCreate.unsubscribe();
      subscriptionUpdate.unsubscribe();
      subscriptionDelete.unsubscribe();
    };

  }, []);  // 空の依存配列を指定して初回レンダリング時のみ実行する

  // メッセージを取得
  async function fetchMessages() {
    try {
      const messageData = await API.graphql(graphqlOperation(getMessage));
      const messages = messageData.data.getMessage;
      setMessages(messages);
    } catch (error) {
      console.error("Error fetching messages", error);
    }
  }

  // メッセージを送信
  async function handleSendMessage() {
    try {
      await API.graphql(graphqlOperation(sendMessage, { Message: inputMessage }));
      setInputMessage("");
    } catch (error) {
      console.error("Error sending message", error);
    }
  }

  // メッセージを削除
  async function handleDeleteMessage(id) {
    try {
      await API.graphql(graphqlOperation(deleteMessage, { MessageID: id }));
    } catch (error) {
      console.error("Error deleting message", error);
    }
  }

  return (
    <div className="App">
      {isAuthenticated ? (
        <>
          <p>ユーザーはログインしています。</p>
          {/* サインアウトボタン */}
          <button onClick={() => Auth.signOut().then(() => setIsAuthenticated(false))}>サインアウト</button>

          {/* メッセージ送信 */}
          <input
            value={inputMessage}
            onChange={event => setInputMessage(event.target.value)}
            placeholder="Message"
          />
          <button onClick={handleSendMessage}>送信</button>

          {/* メッセージ表示 */}
          {messages.sort((a, b) => {return a.Timestamp < b.Timestamp ? -1 : 1}).map(message => (
            <div key={message.MessageID}>
              <p>{message.Message}（{message.Timestamp}）<button onClick={() => handleDeleteMessage(message.MessageID)}>削除</button></p>
            </div>
          ))}
        </>
      ) : (
        <>
          <p>ユーザーはログインしていません。</p>
          {/* ログイン・サインアップボタン */}
          <button onClick={() => Auth.federatedSignIn().then(() => setIsAuthenticated(true))}>ログイン/サインアップ</button>
        </>
      )}
    </div>
  );
}

export default App;
