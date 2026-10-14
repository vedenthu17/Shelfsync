import { useMemo } from 'react';
import type { Book, Member } from '@/types';
import { useLibrary } from '@/context/LibraryContext';

/** Id → record lookups for joining loans, fines and reservations to their book and member. */
export function useLookups() {
  const { db } = useLibrary();
  return useMemo(() => {
    const books = new Map<string, Book>(db.books.map((b) => [b.id, b]));
    const members = new Map<string, Member>(db.members.map((m) => [m.id, m]));
    return {
      book: (id?: string) => (id ? books.get(id) : undefined),
      member: (id?: string) => (id ? members.get(id) : undefined),
      bookTitle: (id?: string) => (id && books.get(id)?.title) || 'Removed title',
      memberName: (id?: string) => (id && members.get(id)?.name) || 'Former member',
    };
  }, [db.books, db.members]);
}
