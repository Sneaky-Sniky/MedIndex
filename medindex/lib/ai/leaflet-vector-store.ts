import type OpenAI from "openai";

export type LeafletVectorSession = {
  vectorStoreId: string | null;
  attachedFileIds: Set<string>;
};

export function createLeafletVectorSession(): LeafletVectorSession {
  return { vectorStoreId: null, attachedFileIds: new Set() };
}

export async function attachFilesToLeafletVectorStore(
  openai: OpenAI,
  session: LeafletVectorSession,
  fileIds: string[],
): Promise<{ vectorStoreId: string; newlyAttached: string[] }> {
  const unique = fileIds.map((id) => id.trim()).filter(Boolean);
  if (unique.length === 0) {
    throw new Error("No OpenAI file IDs to attach");
  }

  if (!session.vectorStoreId) {
    const vs = await openai.vectorStores.create({
      name: `medindex-rag-${Date.now()}`,
    });
    session.vectorStoreId = vs.id;
  }

  const newlyAttached: string[] = [];
  for (const fileId of unique) {
    if (session.attachedFileIds.has(fileId)) continue;
    await openai.vectorStores.files.create(session.vectorStoreId, {
      file_id: fileId,
    });
    session.attachedFileIds.add(fileId);
    newlyAttached.push(fileId);
  }

  return { vectorStoreId: session.vectorStoreId, newlyAttached };
}

export async function deleteLeafletVectorStore(
  openai: OpenAI,
  session: LeafletVectorSession,
): Promise<void> {
  const id = session.vectorStoreId;
  session.vectorStoreId = null;
  session.attachedFileIds.clear();
  if (!id) return;
  try {
    await openai.vectorStores.delete(id);
  } catch {
    // best-effort cleanup
  }
}
