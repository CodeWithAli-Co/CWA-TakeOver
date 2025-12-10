import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Plus,
  X,
  ExternalLink,
  Tag,
  Clock,
  Check,
  Copy,
  Edit,
  Trash2,
  Filter,
  Search,
  Star,
  Code2,
  Video,
  FileText,
  Link as LinkIcon,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

export interface Resource {
  id: string
  title: string
  url: string
  description?: string
  category: 'nextjs' | 'stripe' | 'plaid' | 'yc' | 'react' | 'typescript' | 'design' | 'other'
  type: 'docs' | 'tutorial' | 'article' | 'video' | 'snippet' | 'tool'
  tags: string[]
  readLater: boolean
  completed: boolean
  favorite: boolean
  notes?: string
  addedAt: number
  snippet?: string // For code snippets
}

interface ResourcesStationProps {
  resources: Resource[]
  setResources: (resources: Resource[] | ((prev: Resource[]) => Resource[])) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ResourcesStation = ({ resources, setResources }: ResourcesStationProps) => {
  const [showNewResource, setShowNewResource] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Resource['category'] | 'all'>('all')
  const [selectedType, setSelectedType] = useState<Resource['type'] | 'all'>('all')
  const [showReadLater, setShowReadLater] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [newResource, setNewResource] = useState({
    title: '',
    url: '',
    description: '',
    category: 'nextjs' as Resource['category'],
    type: 'docs' as Resource['type'],
    tags: '',
    snippet: '',
  })

  // ===== HANDLERS =====

  const handleAddResource = () => {
    if (!newResource.title.trim() || !newResource.url.trim()) return

    const resource: Resource = {
      id: `resource-${Date.now()}`,
      title: newResource.title,
      url: newResource.url,
      description: newResource.description,
      category: newResource.category,
      type: newResource.type,
      tags: newResource.tags.split(',').map(t => t.trim()).filter(Boolean),
      readLater: false,
      completed: false,
      favorite: false,
      addedAt: Date.now(),
      snippet: newResource.snippet,
    }

    setResources((prev) => [resource, ...prev])
    setNewResource({
      title: '',
      url: '',
      description: '',
      category: 'nextjs',
      type: 'docs',
      tags: '',
      snippet: '',
    })
    setShowNewResource(false)
  }

  const handleUpdateResource = () => {
    if (!editingResource) return

    setResources((prev) =>
      prev.map((r) => (r.id === editingResource.id ? editingResource : r))
    )
    setEditingResource(null)
  }

  const handleDeleteResource = (id: string) => {
    if (confirm('Delete this resource?')) {
      setResources((prev) => prev.filter((r) => r.id !== id))
    }
  }

  const toggleReadLater = (id: string) => {
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, readLater: !r.readLater } : r))
    )
  }

  const toggleCompleted = (id: string) => {
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r))
    )
  }

  const toggleFavorite = (id: string) => {
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r))
    )
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ===== COMPUTED VALUES =====

  const filteredResources = resources
    .filter((r) => {
      if (showReadLater && !r.readLater) return false
      if (selectedCategory !== 'all' && r.category !== selectedCategory) return false
      if (selectedType !== 'all' && r.type !== selectedType) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          r.title.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query) ||
          r.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          r.url.toLowerCase().includes(query)
        )
      }
      return true
    })
    .sort((a, b) => {
      // Favorites first
      if (a.favorite && !b.favorite) return -1
      if (!a.favorite && b.favorite) return 1
      // Then by date
      return b.addedAt - a.addedAt
    })

  const categories = [
    { id: 'all', label: 'All', count: resources.length },
    { id: 'nextjs', label: 'Next.js', count: resources.filter((r) => r.category === 'nextjs').length },
    { id: 'stripe', label: 'Stripe', count: resources.filter((r) => r.category === 'stripe').length },
    { id: 'plaid', label: 'Plaid', count: resources.filter((r) => r.category === 'plaid').length },
    { id: 'yc', label: 'YC', count: resources.filter((r) => r.category === 'yc').length },
    { id: 'react', label: 'React', count: resources.filter((r) => r.category === 'react').length },
    { id: 'typescript', label: 'TypeScript', count: resources.filter((r) => r.category === 'typescript').length },
    { id: 'design', label: 'Design', count: resources.filter((r) => r.category === 'design').length },
    { id: 'other', label: 'Other', count: resources.filter((r) => r.category === 'other').length },
  ]

  const readLaterCount = resources.filter((r) => r.readLater && !r.completed).length

  // ===== HELPERS =====

  const getCategoryColor = (category: Resource['category']) => {
    switch (category) {
      case 'nextjs':
        return 'bg-black/50 text-white border-zinc-700'
      case 'stripe':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      case 'plaid':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'yc':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'react':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
      case 'typescript':
        return 'bg-blue-600/20 text-blue-400 border-blue-600/50'
      case 'design':
        return 'bg-pink-500/20 text-pink-400 border-pink-500/50'
      default:
        return 'bg-zinc-700/20 text-zinc-400 border-zinc-700/50'
    }
  }

  const getTypeIcon = (type: Resource['type']) => {
    switch (type) {
      case 'docs':
        return <FileText size={14} />
      case 'tutorial':
        return <BookOpen size={14} />
      case 'article':
        return <FileText size={14} />
      case 'video':
        return <Video size={14} />
      case 'snippet':
        return <Code2 size={14} />
      case 'tool':
        return <LinkIcon size={14} />
    }
  }

  // ===== RENDER =====

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen size={24} className="text-teal-500" />
              Resources & Bookmarks
            </h2>
            <p className="text-sm text-zinc-500 mt-1">Your organized knowledge base</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReadLater(!showReadLater)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showReadLater
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-transparent'
              }`}
            >
              <Clock size={16} />
              <span>Read Later</span>
              {readLaterCount > 0 && (
                <span className="bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {readLaterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowNewResource(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
            >
              <Plus size={18} />
              Add Resource
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resources..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg outline-none focus:border-teal-500 transition-colors text-sm"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg outline-none focus:border-teal-500 text-sm"
          >
            <option value="all">All Types</option>
            <option value="docs">Docs</option>
            <option value="tutorial">Tutorials</option>
            <option value="article">Articles</option>
            <option value="video">Videos</option>
            <option value="snippet">Snippets</option>
            <option value="tool">Tools</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Categories Sidebar */}
        <div className="w-56 border-r border-zinc-800 overflow-y-auto p-4">
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  selectedCategory === cat.id
                    ? 'bg-teal-500/20 text-teal-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <span>{cat.label}</span>
                <span className="text-xs opacity-60">{cat.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Resources List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredResources.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No resources found</p>
              <p className="text-sm">Add your first resource to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResources.map((resource) => (
                <motion.div
                  key={resource.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-zinc-900 border rounded-lg overflow-hidden transition-colors ${
                    resource.completed
                      ? 'border-zinc-800 opacity-60'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-2">
                          <button
                            onClick={() => toggleCompleted(resource.id)}
                            className="mt-1 flex-shrink-0"
                          >
                            {resource.completed ? (
                              <Check size={18} className="text-green-500" />
                            ) : (
                              <span className="w-5 h-5 border-2 border-zinc-600 rounded" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getTypeIcon(resource.type)}
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`font-medium hover:text-teal-400 transition-colors flex items-center gap-1 ${
                                  resource.completed ? 'line-through' : ''
                                }`}
                              >
                                {resource.title}
                                <ExternalLink size={12} />
                              </a>
                              {resource.favorite && (
                                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                              )}
                            </div>

                            {resource.description && (
                              <p className="text-sm text-zinc-400 mb-2">{resource.description}</p>
                            )}

                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-xs border ${getCategoryColor(
                                  resource.category
                                )}`}
                              >
                                {resource.category}
                              </span>

                              {resource.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400 flex items-center gap-1"
                                >
                                  <Tag size={10} />
                                  {tag}
                                </span>
                              ))}

                              {resource.readLater && (
                                <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs flex items-center gap-1">
                                  <Clock size={10} />
                                  Read Later
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleFavorite(resource.id)}
                          className="p-2 hover:bg-zinc-800 rounded transition-colors"
                          title="Toggle favorite"
                        >
                          <Star
                            size={16}
                            className={
                              resource.favorite
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-zinc-600'
                            }
                          />
                        </button>

                        <button
                          onClick={() => toggleReadLater(resource.id)}
                          className="p-2 hover:bg-zinc-800 rounded transition-colors"
                          title="Toggle read later"
                        >
                          <Clock
                            size={16}
                            className={resource.readLater ? 'text-orange-400' : 'text-zinc-600'}
                          />
                        </button>

                        <button
                          onClick={() => setEditingResource(resource)}
                          className="p-2 hover:bg-zinc-800 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} className="text-zinc-600 hover:text-zinc-400" />
                        </button>

                        <button
                          onClick={() => handleDeleteResource(resource.id)}
                          className="p-2 hover:bg-zinc-800 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} className="text-zinc-600 hover:text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Code Snippet */}
                    {resource.snippet && (
                      <div className="mt-3 relative">
                        <pre className="p-3 bg-black/30 rounded-lg text-xs overflow-x-auto border border-zinc-800">
                          <code className="text-zinc-300">{resource.snippet}</code>
                        </pre>
                        <button
                          onClick={() => copyToClipboard(resource.snippet!, resource.id)}
                          className="absolute top-2 right-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                        >
                          {copiedId === resource.id ? (
                            <Check size={14} className="text-green-400" />
                          ) : (
                            <Copy size={14} className="text-zinc-400" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Notes */}
                    {resource.notes && (
                      <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg">
                        <p className="text-xs text-zinc-400">{resource.notes}</p>
                      </div>
                    )}

                    {/* URL Preview */}
                    <div className="mt-2 text-xs text-zinc-600 truncate">{resource.url}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showNewResource || editingResource) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowNewResource(false)
              setEditingResource(null)
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">
                {editingResource ? 'Edit Resource' : 'Add Resource'}
              </h3>

              <div className="space-y-4">
                <input
                  type="text"
                  value={editingResource ? editingResource.title : newResource.title}
                  onChange={(e) =>
                    editingResource
                      ? setEditingResource({ ...editingResource, title: e.target.value })
                      : setNewResource((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Resource Title"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                />

                <input
                  type="url"
                  value={editingResource ? editingResource.url : newResource.url}
                  onChange={(e) =>
                    editingResource
                      ? setEditingResource({ ...editingResource, url: e.target.value })
                      : setNewResource((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                />

                <textarea
                  value={editingResource ? editingResource.description : newResource.description}
                  onChange={(e) =>
                    editingResource
                      ? setEditingResource({ ...editingResource, description: e.target.value })
                      : setNewResource((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Description (optional)"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500 resize-none"
                  rows={2}
                />

                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={editingResource ? editingResource.category : newResource.category}
                    onChange={(e) =>
                      editingResource
                        ? setEditingResource({
                            ...editingResource,
                            category: e.target.value as Resource['category'],
                          })
                        : setNewResource((prev) => ({
                            ...prev,
                            category: e.target.value as Resource['category'],
                          }))
                    }
                    className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                  >
                    <option value="nextjs">Next.js</option>
                    <option value="stripe">Stripe</option>
                    <option value="plaid">Plaid</option>
                    <option value="yc">YC Advice</option>
                    <option value="react">React</option>
                    <option value="typescript">TypeScript</option>
                    <option value="design">Design</option>
                    <option value="other">Other</option>
                  </select>

                  <select
                    value={editingResource ? editingResource.type : newResource.type}
                    onChange={(e) =>
                      editingResource
                        ? setEditingResource({
                            ...editingResource,
                            type: e.target.value as Resource['type'],
                          })
                        : setNewResource((prev) => ({
                            ...prev,
                            type: e.target.value as Resource['type'],
                          }))
                    }
                    className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                  >
                    <option value="docs">Documentation</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="article">Article</option>
                    <option value="video">Video</option>
                    <option value="snippet">Code Snippet</option>
                    <option value="tool">Tool</option>
                  </select>
                </div>

                <input
                  type="text"
                  value={
                    editingResource
                      ? editingResource.tags.join(', ')
                      : newResource.tags
                  }
                  onChange={(e) =>
                    editingResource
                      ? setEditingResource({
                          ...editingResource,
                          tags: e.target.value.split(',').map((t) => t.trim()),
                        })
                      : setNewResource((prev) => ({ ...prev, tags: e.target.value }))
                  }
                  placeholder="Tags (comma separated)"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                />

                <textarea
                  value={editingResource ? editingResource.snippet || '' : newResource.snippet}
                  onChange={(e) =>
                    editingResource
                      ? setEditingResource({ ...editingResource, snippet: e.target.value })
                      : setNewResource((prev) => ({ ...prev, snippet: e.target.value }))
                  }
                  placeholder="Code snippet (optional)"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500 resize-none font-mono text-sm"
                  rows={6}
                />

                {editingResource && (
                  <textarea
                    value={editingResource.notes || ''}
                    onChange={(e) =>
                      setEditingResource({ ...editingResource, notes: e.target.value })
                    }
                    placeholder="Notes (optional)"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500 resize-none"
                    rows={3}
                  />
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowNewResource(false)
                    setEditingResource(null)
                  }}
                  className="px-4 py-2 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingResource ? handleUpdateResource : handleAddResource}
                  disabled={
                    editingResource
                      ? !editingResource.title.trim() || !editingResource.url.trim()
                      : !newResource.title.trim() || !newResource.url.trim()
                  }
                  className="px-6 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  {editingResource ? 'Update' : 'Add Resource'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}