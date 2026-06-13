export interface ProjectCache {
  projectHash: string;
  projectName: string;
  schematicSnapshot: string | null;
  boardSnapshot: string | null;
  bomSnapshot: string | null;
  lastSyncedAt: string;
  easyedaVersion: string | null;
}

export interface ArtifactRecord {
  id: string;
  projectHash: string;
  type: 'gerber' | 'bom' | 'pdf' | 'pick-place' | 'netlist' | 'schematic' | 'board';
  filePath: string;
  createdAt: string;
  metadata: string | null;
}
