import React from "react";
import { open, BaseDirectory } from "@tauri-apps/plugin-fs";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { message } from "@tauri-apps/plugin-dialog";
import { ActiveUser } from "@/stores/query";
import supabase from "../supabase";
// import supabase from "./supabase";

interface Styles {
  className: string
}

function UploadAvatar(style: Styles) {
  const { refetch: refetchUser, data: user } = ActiveUser();

  async function RemoveOldAvatar() {
    // Remove Avatar from Storage
    const { error: DeleteError } = await supabase.storage
      .from("avatars")
      .remove([user[0].avatarURL]);
    if (DeleteError) {
      return await message(DeleteError.message, {
        title: "Error Deleting Avatar from Storage",
        kind: "error",
      });
    }

    // Reset User avatar
    const { error: updateError } = await supabase
      .from("app_users")
      .update({ avatar: "default_avatar.png" })
      .eq("supa_id", user[0].supa_id);
    if (updateError) {
      return await message(updateError.message, {
        title: "Error Resetting User Avatar",
        kind: "error",
      });
    }
  }

  async function Upload() {
    // Delete old file before uploading new one
    await RemoveOldAvatar();

    // Let user select image
    const file = await openDialog({
      multiple: false,
      directory: false,
    });

    // Read file and make it a Uint8Array buffer
    const icon = await open(file!, {
      read: true,
      baseDir: BaseDirectory.Desktop,
    });
    const stat = await icon.stat();
    const buf = new Uint8Array(stat.size);
    await icon.read(buf);

    // Convert Uint8Array to Blob
    const blob = new Blob([buf]);

    // Create avatar filename for user
    const fileName = user[0].username + "Avatar";

    // Upload file to Supabase Storage
    const { error } = await supabase.storage
      .from("avatars")
      .upload(`${fileName}.png`, blob, {
        cacheControl: '1',
        contentType: "image/*",
        upsert: true,
      });
    if (error) {
      await message(error.message, {
        title: "Avatar Upload",
        kind: "error",
      });
    } else {
      // Write file name to user's avatar row
      const { error: updateError } = await supabase
        .from("app_users")
        .update({ avatar: `${fileName}.png` })
        .eq("supa_id", user[0].supa_id);
      if (updateError) {
        return await message(updateError.message, {
          title: "Adding Avatar Error",
          kind: "error",
        });
      }

      // Write file name to DM user's avatar row
      // const { error: DMUpdateError } = await supabase
      //   .from("cwa_dm_chat")
      //   .update({ userAvatar: `${fileName}.png` })
      //   .eq("sent_by", user[0].username);
      // if (DMUpdateError) {
      //   return await message(DMUpdateError.message, {
      //     title: "Adding Avatar to DM Error",
      //     kind: "error",
      //   });
      // }

      sendNotification({
        title: "Avatar Uploaded!"
      });
    }

    // Close file and reset form
    await icon.close();

    setTimeout(() => {
      refetchUser();
    }, 2000);
  }
  return (
    <>
      <button type="button" onClick={() => Upload()} className={style.className}>
        Add/Update Avatar
      </button>
    </>
  );
}

export default UploadAvatar;
