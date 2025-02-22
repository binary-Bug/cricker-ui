import { DocumentData } from '@angular/fire/firestore';

export interface LoadMatchDTO {
  id: string;
  data: DocumentData;
}
