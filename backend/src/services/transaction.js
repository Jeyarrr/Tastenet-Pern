export async function transaction(db, action) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function audit(client, user, action, table, id, details = null) {
  await client.query(
    `INSERT INTO tastenet.audit_logs
    (action_type,table_name,record_id,new_value,performed_by,performed_date)
    VALUES ($1,$2,$3,$4,$5,now())`,
    [
      action,
      table,
      String(id),
      details ? JSON.stringify(details) : null,
      String(user.id),
    ],
  );
}
