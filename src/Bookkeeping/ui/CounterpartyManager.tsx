// CounterpartyManager — list of customers + vendors per entity, with
// an inline add form. Used by JE editor (line.counterpartyId) and by
// AR/AP aging reports.

import { useState } from "react";
import type { Entity } from "../types/entity";
import type { Counterparty, CounterpartyKind } from "../types/counterparty";
import { useCounterparties, selectCounterparties } from "../stores/counterpartyStore";
import { newId } from "../stores/ledgerStore";

export function CounterpartyManager({ entity }: { entity: Entity }) {
  useCounterparties((s) => s.counterparties);
  const list = selectCounterparties(entity.id);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<CounterpartyKind>("customer");
  const [email, setEmail] = useState("");

  const upsert = useCounterparties((s) => s.upsert);
  const archive = useCounterparties((s) => s.archive);

  const handleAdd = () => {
    if (!name.trim()) return;
    const c: Counterparty = {
      id: newId("cp_"),
      entityId: entity.id,
      name: name.trim(),
      kind,
      email: email.trim() || undefined,
    };
    upsert(c);
    setName("");
    setEmail("");
  };

  return (
    <section className="bk-section">
      <h2 className="bk-section-title">Counterparties · {entity.name}</h2>
      <p className="bk-section-blurb">
        Customers and vendors. Tag journal lines with a counterparty so AR / AP
        aging reports can break down what each customer owes you.
      </p>

      <div className="bk-cp-add">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="bk-input"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as CounterpartyKind)}
          className="bk-input bk-mono"
        >
          <option value="customer">Customer</option>
          <option value="vendor">Vendor</option>
          <option value="both">Both</option>
        </select>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email (optional)"
          className="bk-input"
        />
        <button type="button" className="bk-btn-primary" onClick={handleAdd}>
          Add
        </button>
      </div>

      {list.length === 0 ? (
        <p className="bk-muted" style={{ marginTop: 18 }}>None yet.</p>
      ) : (
        <table className="bk-table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 100 }}>Kind</th>
              <th>Email</th>
              <th style={{ width: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="bk-mono bk-muted">{c.kind}</td>
                <td className="bk-muted">{c.email || ""}</td>
                <td>
                  <button
                    type="button"
                    className="bk-icon-btn"
                    onClick={() => archive(c.id)}
                    title="Archive"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
