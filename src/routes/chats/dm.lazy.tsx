import { ChatInputBox } from "@/MyComponents/chatInput";
import { ActiveUser, DMGroups, DMs, Employees } from "@/stores/query";
import { useAppStore } from "@/stores/store";
import { createLazyFileRoute } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { AddDMGroup } from "@/MyComponents/subForms/addDMGroup";

function DMChannels() {
  const { DMGroupName, setDMGroupName } = useAppStore();
  const { data: AllEmployees, error: AllEmpError } = Employees();
  if (AllEmpError)
    return console.log("Error fetching All Employees:", AllEmpError.message);

  const { data: user, error: userError } = ActiveUser();
  if (userError) {
    return console.log("Error getting active user in DM's", userError.message);
  }

  const { data: DmGroups, error } = DMGroups(user![0].username);
  if (error) return "Error fetching Groups";

  const { data: DM, error: DMError, isPending: LoadingMsg } = DMs(DMGroupName);
  if (LoadingMsg) return "Loading...";
  if (DMError) return "Error fetching DM Message(s)";

  return (
    <>
      <div className="chat-page">
        <h3>DM's</h3>
        <Dialog>
          <DialogTrigger>Add Group</DialogTrigger>
          <DialogTitle>Create New DM Group</DialogTitle>
          <DialogDescription>
            Select atleast one person you'd like to send private message to.
          </DialogDescription>
          <DialogContent>
            <AddDMGroup Users={AllEmployees} />
          </DialogContent>
        </Dialog>
        <h3>Groups</h3>
        {DmGroups?.map((group) => (
          <div key={group.id} onClick={() => setDMGroupName(group.name)}>
            {group.name}
          </div>
        ))}

        <h3>Chat</h3>
        <div>
          {DM?.map((dm) => <div key={dm.msg_id}>{dm.message}</div>)}
          <ChatInputBox
            activeUser={user![0].username}
            table="cwa_dm_chat"
            DmGroup={DMGroupName}
          />
        </div>
      </div>
    </>
  );
}

export const Route = createLazyFileRoute("/chats/dm")({
  component: DMChannels,
});
