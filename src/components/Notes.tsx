import React, { useState } from 'react';
import { formatDate } from '../utils/format';
import { Note, Tag } from '../types/database';
import { Calendar, Trash2, Pin, Archive, Tag as TagIcon } from 'lucide-react';

interface NotesProps {
  notes: Note[];
  onAddNote: (note: Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<void>;
}

export const Notes: React.FC<NotesProps> = ({ notes, onAddNote, onDeleteNote, onUpdateNote }) => {
  console.log('Notes component rendered with notes:', notes);
  const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.title.trim() || !newNote.content.trim()) return;

    const tags = newNote.tags
      ? newNote.tags.split(',').map(tag => ({ name: tag.trim() }))
      : [];

    console.log('Submitting new note:', { ...newNote, tags });
    
    await onAddNote({
      title: newNote.title.trim(),
      content: newNote.content.trim(),
      is_archived: false,
      is_pinned: false,
      tags: tags as Tag[]
    });

    setNewNote({ title: '', content: '', tags: '' });
  };

  const filteredNotes = notes.filter(note => {
    if (filter === 'archived') return note.is_archived;
    if (filter === 'active') return !note.is_archived;
    return true;
  });

  console.log('Filtered notes:', filteredNotes);

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    // First sort by pinned status
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    // Then sort by creation date
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  console.log('Sorted notes:', sortedNotes);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-3 py-1 rounded ${filter === 'active' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('archived')}
          className={`px-3 py-1 rounded ${filter === 'archived' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Archived
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={newNote.title}
          onChange={e => setNewNote(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Note title"
          className="w-full p-2 border rounded"
        />
        <textarea
          value={newNote.content}
          onChange={e => setNewNote(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Note content"
          className="w-full p-2 border rounded"
          rows={3}
        />
        <input
          type="text"
          value={newNote.tags}
          onChange={e => setNewNote(prev => ({ ...prev, tags: e.target.value }))}
          placeholder="Tags (comma separated)"
          className="w-full p-2 border rounded"
        />
        <button
          type="submit"
          className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Note
        </button>
      </form>

      <div className="space-y-4">
        {sortedNotes.map(note => (
          <div
            key={note.id}
            className={`p-4 rounded-lg border ${
              note.is_archived ? 'bg-gray-50' : 'bg-white'
            } relative`}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold">{note.title}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdateNote(note.id, { is_pinned: !note.is_pinned })}
                  className={`p-1 rounded hover:bg-gray-100 ${
                    note.is_pinned ? 'text-blue-500' : 'text-gray-500'
                  }`}
                >
                  <Pin size={16} />
                </button>
                <button
                  onClick={() => onUpdateNote(note.id, { is_archived: !note.is_archived })}
                  className={`p-1 rounded hover:bg-gray-100 ${
                    note.is_archived ? 'text-blue-500' : 'text-gray-500'
                  }`}
                >
                  <Archive size={16} />
                </button>
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="p-1 rounded hover:bg-gray-100 text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="text-gray-600 mb-2">{note.content}</p>
            {note.tags && note.tags.length > 0 && (
              <div className="flex gap-2 mb-2">
                {note.tags.map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                  >
                    <TagIcon size={12} />
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            <div className="text-sm text-gray-400">
              {formatDate(note.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};