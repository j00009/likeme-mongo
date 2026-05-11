import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const api = {
  posts: '/api/posts',
  comments: '/api/comments',
};

const userStorageKey = 'likeme:user-profile';

const emptyPost = {
  URL: '',
  descripcion: '',
};

const emptyProfile = {
  nombre: '',
  avatar: '',
};

const getStoredProfile = () => {
  try {
    return { ...emptyProfile, ...JSON.parse(localStorage.getItem(userStorageKey)) };
  } catch (error) {
    return emptyProfile;
  }
};

const fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
};

const normalizeImageFile = (file, maxSize = 1280, quality = 0.86) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;
        context.fillStyle = '#f8fafc';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };

      image.onerror = () => reject(new Error('No se pudo procesar la imagen'));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Error al procesar la solicitud');
  }

  return data;
};

function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(getStoredProfile);

  const stats = useMemo(() => ({
    posts: posts.length,
    likes: posts.reduce((total, post) => total + (post.likes || 0), 0),
    comments: posts.reduce((total, post) => total + (post.comentarios?.length || 0), 0),
  }), [posts]);

  const notify = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  };

  const saveUserProfile = (profile) => {
    const cleanProfile = {
      nombre: profile.nombre.trim(),
      avatar: profile.avatar.trim(),
    };

    localStorage.setItem(userStorageKey, JSON.stringify(cleanProfile));
    setUserProfile(cleanProfile);
    notify('Perfil local guardado');
  };

  const ensureProfile = () => {
    if (!userProfile.nombre.trim()) {
      notify('Guarda tu perfil local antes de publicar o comentar', 'error');
      document.querySelector('#profile-name')?.focus();
      return false;
    }

    return true;
  };

  const loadPosts = async () => {
    setLoading(true);

    try {
      const data = await request(api.posts);
      setPosts(data);
    } catch (error) {
      notify(error.message || 'No se pudieron cargar los posts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const createPost = async (payload) => {
    const data = await request(api.posts, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        usuario: userProfile.nombre,
        avatar: userProfile.avatar,
      }),
    });

    setPosts((current) => [data, ...current]);
    notify('Publicacion creada');
  };

  const updatePost = async (id, payload) => {
    const data = await request(`${api.posts}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    setPosts((current) => current.map((post) => (post.id === id ? data : post)));
    setEditTarget(null);
    notify('Publicacion actualizada');
  };

  const likePost = async (id) => {
    const data = await request(`${api.posts}/${id}/like`, { method: 'PATCH' });
    setPosts((current) => current.map((post) => (post.id === id ? data : post)));
  };

  const deletePost = async () => {
    if (!deleteTarget) return;

    await request(`${api.posts}/${deleteTarget.id}`, { method: 'DELETE' });
    setPosts((current) => current.filter((post) => post.id !== deleteTarget.id));
    setDeleteTarget(null);
    notify('Publicacion eliminada');
  };

  const createComment = async (payload) => {
    const data = await request(api.comments, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        usuario: userProfile.nombre,
        avatar: userProfile.avatar,
      }),
    });

    setPosts((current) => current.map((post) => {
      if (post.id !== payload.post) return post;

      return {
        ...post,
        comentarios: [...(post.comentarios || []), data],
      };
    }));
    notify('Comentario agregado');
  };

  const deleteComment = async (postId, commentId) => {
    await request(`${api.comments}/${commentId}`, { method: 'DELETE' });
    setPosts((current) => current.map((post) => {
      if (post.id !== postId) return post;

      return {
        ...post,
        comentarios: (post.comentarios || []).filter((comment) => comment.id !== commentId),
      };
    }));
    notify('Comentario eliminado');
  };

  const guardedAction = async (action, fallback) => {
    try {
      return await action();
    } catch (error) {
      notify(error.message || fallback, 'error');
      return false;
    }
  };

  return (
    <>
      <Navbar onRefresh={loadPosts} onOpenComposer={() => setComposerOpen(true)} />
      <main className="app-shell">
        <Sidebar
          stats={stats}
          userProfile={userProfile}
          onProfileSave={saveUserProfile}
        />
        <Feed
          posts={posts}
          loading={loading}
          onLike={(id) => guardedAction(() => likePost(id), 'No se pudo dar like')}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          onComment={(payload) => guardedAction(async () => {
            if (!ensureProfile()) return false;
            await createComment(payload);
            return true;
          }, 'No se pudo crear el comentario')}
          onDeleteComment={(postId, commentId) => guardedAction(() => deleteComment(postId, commentId), 'No se pudo eliminar el comentario')}
        />
      </main>
      <button className="floating-post-button" type="button" onClick={() => setComposerOpen(true)}>
        <i className="bi bi-plus-lg" />
      </button>
      {toast && <Toast toast={toast} />}
      {composerOpen && (
        <PostComposerDialog
          onCancel={() => setComposerOpen(false)}
          onCreate={(payload) => guardedAction(async () => {
            if (!ensureProfile()) return false;
            await createPost(payload);
            setComposerOpen(false);
            return true;
          }, 'No se pudo crear el post')}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar publicacion"
          message="Esta accion eliminara tambien sus comentarios."
          onCancel={() => setDeleteTarget(null)}
          onAccept={() => guardedAction(deletePost, 'No se pudo eliminar el post')}
        />
      )}
      {editTarget && (
        <EditDialog
          post={editTarget}
          onCancel={() => setEditTarget(null)}
          onSave={(id, payload) => guardedAction(() => updatePost(id, payload), 'No se pudo actualizar el post')}
        />
      )}
    </>
  );
}

function Navbar({ onRefresh, onOpenComposer }) {
  return (
    <nav className="topbar">
      <a className="brand" href="/">
        <span className="brand-mark"><i className="bi bi-heart-fill" /></span>
        <span>Like Me</span>
      </a>
      <div className="topbar-actions">
        <button className="icon-button" type="button" title="Recargar feed" onClick={onRefresh}>
          <i className="bi bi-arrow-clockwise" />
        </button>
        <button className="primary-button" type="button" onClick={onOpenComposer}>
          <i className="bi bi-plus-lg" />
          <span>Nuevo post</span>
        </button>
      </div>
    </nav>
  );
}

function Sidebar({ stats, userProfile, onProfileSave }) {
  return (
    <aside className="composer-panel" aria-label="Perfil y resumen">
      <ProfileCard profile={userProfile} onSave={onProfileSave} />
      <section className="stats-panel" aria-label="Resumen">
        <Stat value={stats.posts} label="posts" />
        <Stat value={stats.likes} label="likes" />
        <Stat value={stats.comments} label="comentarios" />
      </section>
    </aside>
  );
}

function PostComposerDialog({ onCancel, onCreate }) {
  const [form, setForm] = useState(emptyPost);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleImageFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await normalizeImageFile(file);
    updateField('URL', dataUrl);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const created = await onCreate(form);
      if (created !== false) setForm(emptyPost);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dialog-backdrop">
      <section className="dialog post-composer-dialog">
        <div className="dialog-header">
          <div>
            <span className="eyebrow">Publicar</span>
            <h3>Nueva publicacion</h3>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} title="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="composer-form" onSubmit={handleSubmit}>
          <label>
            URL de imagen
            <input id="post-url" type="url" value={form.URL} onChange={(event) => updateField('URL', event.target.value)} placeholder="https://..." required />
          </label>
          <label>
            Imagen local
            <input className="file-input" type="file" accept="image/*" onChange={handleImageFile} />
          </label>
          {form.URL && (
            <div className="image-preview">
              <img src={form.URL} alt="Vista previa de la publicacion" />
            </div>
          )}
          <label>
            Descripcion
            <textarea value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} rows="5" placeholder="Cuenta que esta pasando..." required minLength="2" maxLength="280" />
          </label>
          <div className="dialog-actions">
            <button className="ghost-button" type="button" onClick={onCancel}>Cancelar</button>
            <button className="submit-button compact" type="submit" disabled={submitting}>
              <i className="bi bi-send-fill" />
              <span>{submitting ? 'Publicando...' : 'Crear'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProfileCard({ profile, onSave }) {
  const [form, setForm] = useState(profile);

  useEffect(() => {
    setForm(profile);
  }, [profile]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await fileToDataUrl(file);
    updateField('avatar', dataUrl);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  const initial = form.nombre?.trim().charAt(0).toUpperCase() || 'U';

  return (
    <section className="profile-card">
      <div className="profile-preview">
        {form.avatar ? (
          <img src={form.avatar} alt="" className="avatar" />
        ) : (
          <div className="avatar avatar-fallback">{initial}</div>
        )}
        <div>
          <span className="eyebrow">Perfil local</span>
          <h2>{profile.nombre || 'Configura tu usuario'}</h2>
          <p>{profile.nombre ? 'Se usara automaticamente en posts y comentarios.' : 'Tu identidad queda guardada en este navegador.'}</p>
        </div>
      </div>

      <form className="composer-form compact-form" onSubmit={handleSubmit}>
        <label>
          Nombre
          <input id="profile-name" type="text" value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} placeholder="Ej: Camila Torres" required minLength="2" />
        </label>
        <label>
          Avatar
          <input type="url" value={form.avatar} onChange={(event) => updateField('avatar', event.target.value)} placeholder="https://..." />
        </label>
        <label>
          Avatar local
          <input className="file-input" type="file" accept="image/*" onChange={handleAvatarFile} />
        </label>
        <button className="ghost-button profile-save" type="submit">
          <i className="bi bi-person-check" />
          <span>Guardar perfil</span>
        </button>
      </form>
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Feed({ posts, loading, onLike, onEdit, onDelete, onComment, onDeleteComment }) {
  return (
    <section className="feed-section" aria-label="Feed principal">
      <div className="feed-header">
        <div>
          <span className="eyebrow">Feed</span>
          <h2>Publicaciones recientes</h2>
        </div>
        <div className="feed-status">{loading ? 'Cargando...' : 'Sincronizado'}</div>
      </div>

      {loading && (
        <div className="loading-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="empty-state">
          <i className="bi bi-images" />
          <h3>Aun no hay publicaciones</h3>
          <p>Crea el primer post para iniciar el feed.</p>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="posts-grid">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={onLike}
              onEdit={onEdit}
              onDelete={onDelete}
              onComment={onComment}
              onDeleteComment={onDeleteComment}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PostCard({ post, onLike, onEdit, onDelete, onComment, onDeleteComment }) {
  const comments = post.comentarios || [];
  const user = post.usuario || post.autorNombre || 'Usuario';
  const avatar = post.avatar || post.autor?.avatar || '';

  return (
    <article className="post-card">
      <header className="post-header">
        <div className="post-author">
          <img src={avatar} alt="" className="avatar" />
          <div>
            <h3>{user}</h3>
            <time>{formatDate(post.createdAt || Date.now())}</time>
          </div>
        </div>
        <div className="post-menu">
          <button className="icon-button soft" type="button" onClick={() => onEdit(post)} title="Editar">
            <i className="bi bi-pencil" />
          </button>
          <button className="icon-button danger-soft" type="button" onClick={() => onDelete(post)} title="Eliminar">
            <i className="bi bi-trash3" />
          </button>
        </div>
      </header>

      <img className="post-image" src={post.url} alt={post.descripcion} />

      <div className="post-content">
        <p>{post.descripcion}</p>
        <div className="post-actions">
          <button className="like-button" type="button" onClick={() => onLike(post.id)}>
            <i className="bi bi-heart-fill" />
            <span>{post.likes || 0}</span>
          </button>
          <span className="comment-count">
            <i className="bi bi-chat-dots" />
            {comments.length}
          </span>
        </div>
      </div>

      <section className="comments">
        <ul>
          {comments.map((comment) => (
            <CommentItem key={comment.id} postId={post.id} comment={comment} onDelete={onDeleteComment} />
          ))}
        </ul>
        <CommentForm postId={post.id} onComment={onComment} />
      </section>
    </article>
  );
}

function CommentItem({ postId, comment, onDelete }) {
  const avatar = comment.avatar || comment.autor?.avatar || '';
  const user = comment.usuario || comment.autorNombre || 'Usuario';

  return (
    <li className="comment-item">
      <img src={avatar} alt="" className="mini-avatar" />
      <div>
        <strong>{user}</strong>
        <p>{comment.texto}</p>
        <time>{formatDate(comment.createdAt)}</time>
      </div>
      <button className="comment-delete" type="button" onClick={() => onDelete(postId, comment.id)} title="Eliminar comentario">
        <i className="bi bi-x-lg" />
      </button>
    </li>
  );
}

function CommentForm({ postId, onComment }) {
  const [texto, setTexto] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onComment({ post: postId, texto });
    setTexto('');
  };

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <input value={texto} onChange={(event) => setTexto(event.target.value)} name="texto" type="text" placeholder="Escribe un comentario" required maxLength="180" />
      <button type="submit" title="Comentar">
        <i className="bi bi-send" />
      </button>
    </form>
  );
}

function Toast({ toast }) {
  return (
    <div className="toast-container" aria-live="polite">
      <div className={`toast toast-${toast.type}`}>
        <i className={`bi ${toast.type === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle'}`} />
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onCancel, onAccept }) {
  return (
    <div className="dialog-backdrop">
      <section className="dialog">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>Cancelar</button>
          <button className="danger-button" type="button" onClick={onAccept}>Eliminar</button>
        </div>
      </section>
    </div>
  );
}

function EditDialog({ post, onCancel, onSave }) {
  const [form, setForm] = useState({
    usuario: post.usuario || post.autorNombre || '',
    url: post.url || '',
    descripcion: post.descripcion || '',
  });

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSave(post.id, form);
  };

  return (
    <div className="dialog-backdrop">
      <section className="dialog edit-dialog">
        <h3>Editar publicacion</h3>
        <form className="composer-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input value={form.usuario} onChange={(event) => updateField('usuario', event.target.value)} type="text" required minLength="2" />
          </label>
          <label>
            URL de imagen
            <input value={form.url} onChange={(event) => updateField('url', event.target.value)} type="url" required />
          </label>
          <label>
            Descripcion
            <textarea value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} rows="4" required minLength="2" maxLength="280" />
          </label>
          <div className="dialog-actions">
            <button className="ghost-button" type="button" onClick={onCancel}>Cancelar</button>
            <button className="submit-button compact" type="submit">Guardar</button>
          </div>
        </form>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
