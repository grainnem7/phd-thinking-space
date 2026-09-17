import { useState, useId } from 'react';
import Modal from '../common/Modal';
import { X } from 'lucide-react';

const INPUT_CLASS = 'w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500';
const LABEL_CLASS = 'block text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5';

function initialForm(task) {
  return {
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'medium',
    tags: task?.tags || [],
    dueDate: task?.dueDate || '',
  };
}

// Mounted fresh each time the dialog opens (Modal renders nothing while
// closed), so the form starts from the task without syncing in an effect.
function TaskForm({ task, columnId, onSave, onClose }) {
  const id = useId();
  const [formData, setFormData] = useState(() => initialForm(task));
  const [tagInput, setTagInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const title = formData.title.trim();
    if (!title) return;

    onSave({
      id: task?.id,
      columnId: task?.columnId || columnId,
      title,
      description: formData.description.trim(),
      priority: formData.priority,
      tags: formData.tags,
      dueDate: formData.dueDate || null,
    });
    onClose();
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (!formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor={`${id}-title`} className={LABEL_CLASS}>Title</label>
        <input
          id={`${id}-title`}
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Task title"
          required
          autoFocus
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label htmlFor={`${id}-description`} className={LABEL_CLASS}>Description</label>
        <textarea
          id={`${id}-description`}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Add a description..."
          rows={3}
          className={`${INPUT_CLASS} resize-none`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${id}-priority`} className={LABEL_CLASS}>Priority</label>
          <select
            id={`${id}-priority`}
            value={formData.priority}
            onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
            className={INPUT_CLASS}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label htmlFor={`${id}-due`} className={LABEL_CLASS}>Due date</label>
          <input
            id={`${id}-due`}
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
            className={`${INPUT_CLASS} dark:[color-scheme:dark]`}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-tag`} className={LABEL_CLASS}>Tags</label>
        {formData.tags.length > 0 && (
          <ul className="flex gap-2 mb-2 flex-wrap">
            {formData.tags.map((tag) => (
              <li
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-2 sm:py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-sm sm:text-xs rounded"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                  title="Remove tag"
                  className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors"
                >
                  <X size={14} className="sm:w-3 sm:h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            id={`${id}-tag`}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add a tag..."
            className={`${INPUT_CLASS} flex-1`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <button
            type="button"
            onClick={addTag}
            className="px-4 py-2.5 sm:px-3 sm:py-2 text-base sm:text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 sm:px-3 sm:py-2 text-base sm:text-sm text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!formData.title.trim()}
          className="px-4 py-2.5 sm:px-3 sm:py-2 text-base sm:text-sm bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {task ? 'Save' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function TaskModal({ isOpen, onClose, task, onSave, columnId }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? 'Edit Task' : 'New Task'}
      size="md"
    >
      <TaskForm
        key={task?.id ?? `new-${columnId}`}
        task={task}
        columnId={columnId}
        onSave={onSave}
        onClose={onClose}
      />
    </Modal>
  );
}
