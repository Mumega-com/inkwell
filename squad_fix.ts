// Fix squad_id INSERT bug + agent claiming auth
// Addresses issue #43

import { v4 as uuidv4 } from 'uuid';

interface Squad {
  id: string;
  name: string;
  members: string[];
  createdAt: Date;
}

interface Agent {
  id: string;
  pubkey: string;
  squadId: string | null;
}

class SquadService {
  private squads: Map<string, Squad> = new Map();

  createSquad(name: string, creatorPubkey: string): Squad {
    const id = uuidv4();
    const squad: Squad = { id, name, members: [creatorPubkey], createdAt: new Date() };
    this.squads.set(id, squad);
    return squad;
  }

  // Fix: validate squad_id before INSERT to prevent null/undefined errors
  assignAgentToSquad(agent: Agent, squadId: string): Agent {
    if (!squadId || !this.squads.has(squadId)) {
      throw new Error('Invalid squad_id: squad does not exist');
    }
    const squad = this.squads.get(squadId)!;
    if (!squad.members.includes(agent.pubkey)) {
      squad.members.push(agent.pubkey);
    }
    return { ...agent, squadId };
  }

  // Fix: verify agent auth before claiming operations
  verifyAgentClaim(agent: Agent, requiredSquadId: string): boolean {
    if (!agent.pubkey) return false;
    if (agent.squadId !== requiredSquadId) return false;
    const squad = this.squads.get(requiredSquadId);
    return squad !== undefined && squad.members.includes(agent.pubkey);
  }
}

export default SquadService;
