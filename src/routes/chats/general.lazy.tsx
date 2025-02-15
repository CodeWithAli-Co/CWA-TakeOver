import { ChatInputBox } from "@/MyComponents/chatInput";
import { ActiveUser, Messages } from "@/stores/query";
import { createLazyFileRoute } from "@tanstack/react-router";

interface Msg {
  msg_id: number;
  sent_by: string;
  created_at: any;
  message: string;
}

function General() {
  const { data, error } = Messages();
  if (error) return "Error Loading Messages...";

  const { data: user, error: userError } = ActiveUser();
  if (userError)
    return console.log("Error getting active user in DM's", userError.message);

  return (
    <>
      <div className="chat-page">
        <h3>General Channel</h3>
        {data?.map((msg: Msg) => (
          <div key={msg.msg_id}>
            <p>{msg.message}</p>
            <p>Sent By: {msg.sent_by}</p>
          </div>
        ))}
        <ChatInputBox activeUser={user![0].username} table="cwa_chat" />
      </div>
    </>
  );
}

export const Route = createLazyFileRoute("/chats/general")({
  component: General,
});
