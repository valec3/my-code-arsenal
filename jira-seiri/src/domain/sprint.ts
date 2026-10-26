export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate: string | null;
  endDate: string | null;
  boardId: number | null;
}

export interface CreateSprintInput {
  name: string;
  boardId: number;
  startDate?: string;
  endDate?: string;
}

export interface StartSprintInput {
  id: number;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
}
