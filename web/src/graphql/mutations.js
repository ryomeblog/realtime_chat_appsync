/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const sendMessage = /* GraphQL */ `
  mutation SendMessage($Message: String!) {
    sendMessage(Message: $Message) {
      MessageID
      UserID
      Timestamp
      Message
    }
  }
`;
export const editMessage = /* GraphQL */ `
  mutation EditMessage($MessageID: String!, $Message: String!) {
    editMessage(MessageID: $MessageID, Message: $Message) {
      MessageID
      UserID
      Timestamp
      Message
    }
  }
`;
export const deleteMessage = /* GraphQL */ `
  mutation DeleteMessage($MessageID: String!) {
    deleteMessage(MessageID: $MessageID) {
      MessageID
      UserID
      Timestamp
      Message
    }
  }
`;
