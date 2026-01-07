import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { X } from 'lucide-react';

export default function TaskModal({ isOpen, onClose, task, onSave, columnId }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    tags: [],
    dueDate: '',
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        tags: task.tags || [],
        dueDate: task.dueDate || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        tags: [],
        dueDate: '',
      });
    }
    setTagInput('');
  }, [task, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    onSave({
      ...task,
      ...formData,
      columnId: task?.columnId || columnId,
    });
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? 'Edit Task' : 'New Task'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5">Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Task title"
            required
            autoFocus
            className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-1.5">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Add a description..."
            rows={3}
            className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
              className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Due Date</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-1.5">Tags</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-2 sm:py-1 bg-neutral-100 text-neutral-600 text-sm sm:text-xs rounded"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X size={14} className="sm:w-3 sm:h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag..."
              className="flex-1 px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <button type="button" onClick={addTag} className="px-4 py-2.5 sm:px-3 sm:py-2 text-base sm:text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              Add
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-neutral-100">
          <button type="button" onClick={onClose} className="px-4 py-2.5 sm:px-3 sm:py-2 text-base sm:text-sm text-neutral-400 hover:text-neutral-600 transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2.5 sm:px-3 sm:py-2 text-base sm:text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors">
            {task ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
