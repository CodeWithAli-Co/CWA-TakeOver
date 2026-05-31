import { Client, Stronghold } from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";

export class TakeOverStronghold {
  private stronghold: any;
  private store: any;

  public async init() {
    const vaultPath = `${await appDataDir()}/vault.hold`;
    const getVaultPassword = async () => {
      const res = await fetch(
        `${import.meta.env.VITE_TAKEOVER_SITE_URL}/api/takeover_creds`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "TakeOver-App": "true",
          },
        },
      );
      const result = await res.json();
      return result.vault_password;
    };
    const vaultPassword = await getVaultPassword();
    const stronghold = await Stronghold.load(vaultPath, vaultPassword);

    let client: Client;
    const clientName = "TakeOver Systems";
    try {
      client = await stronghold.loadClient(clientName);
    } catch {
      client = await stronghold.createClient(clientName);
    }

    this.stronghold = stronghold;
    this.store = client.getStore();
    console.log("Stronghold Initialized!");

    try {
      const sync_data = await this.store.get("last_synced");
      const last_synced = Number(
        new TextDecoder().decode(new Uint8Array(sync_data)),
      );
      const last_synced_date = new Date(last_synced);
      const expire_sync_date = new Date(last_synced);
      // *Invalidate stronghold creds after 1 week
      expire_sync_date.setDate(last_synced_date.getDate() + 7);

      if (last_synced_date >= expire_sync_date) {
        console.log("Stronghold outdated, invalidating...");
        await stronghold.unload(); // *Not sure if this actually delete/clears the stronghold
      }
    } catch (err) {
      console.error("Error checking when Stronghold was last synced; ", err);
    }
  }
  public async getRecord(key: string) {
    const data = await this.store.get(key);
    return new TextDecoder().decode(new Uint8Array(data));
  }

  public async insertRecord(key: string, value: string) {
    const data = Array.from(new TextEncoder().encode(value));
    await this.store.insert(key, data);
    await this.store.insert("last_synced", Date.now());
    await this.stronghold.save();
  }

  public async removeRecord(key: string) {
    await this.store.remove(key);
    await this.stronghold.save();
  }
}
