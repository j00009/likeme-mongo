import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const api = {
  posts: '/api/posts',
  comments: '/api/comments',
  users: '/api/users',
};

const sessionStorageKey = 'likeme:session';

const emptyPost = {
  URL: '',
  descripcion: '',
};

const emptyAuthForm = {
  nombre: '',
  email: '',
  password: '',
  avatar: '',
};

const getStoredSession = () => {
  try {
    return JSON.parse(localStorage.getItem(sessionStorageKey)) || null;
  } catch (error) {
    return null;
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

const request = async (url, options = {}, token = '') => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
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
  const [commentsTarget, setCommentsTarget] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [session, setSession] = useState(getStoredSession);

  const currentUser = session?.user || null;
  const authToken = session?.token || '';

  const stats = useMemo(() => ({
    posts: posts.length,
    likes: posts.reduce((total, post) => total + (post.likes || 0), 0),
    comments: posts.reduce((total, post) => total + (post.comentarios?.length || 0), 0),
  }), [posts]);

  const notify = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  };

  const saveSession = (nextSession) => {
    localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const logout = () => {
    localStorage.removeItem(sessionStorageKey);
    setSession(null);
    notify('Sesion cerrada');
  };

  const register = async (payload) => {
    const data = await request(`${api.users}/register`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    saveSession(data);
    notify('Usuario registrado');
  };

  const login = async (payload) => {
    const data = await request(`${api.users}/login`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    saveSession(data);
    notify('Sesion iniciada');
  };

  const ensureSession = () => {
    if (!currentUser) {
      notify('Inicia sesion para publicar o comentar', 'error');
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
      body: JSON.stringify(payload),
    }, authToken);

    setPosts((current) => [data, ...current]);
    notify('Publicacion creada');
  };

  const updatePost = async (id, payload) => {
    const data = await request(`${api.posts}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, authToken);

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

    await request(`${api.posts}/${deleteTarget.id}`, { method: 'DELETE' }, authToken);
    setPosts((current) => current.filter((post) => post.id !== deleteTarget.id));
    setDeleteTarget(null);
    notify('Publicacion eliminada');
  };

  const createComment = async (payload) => {
    const data = await request(api.comments, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, authToken);

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
    await request(`${api.comments}/${commentId}`, { method: 'DELETE' }, authToken);
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
          currentUser={currentUser}
          onLogin={(payload) => guardedAction(() => login(payload), 'No se pudo iniciar sesion')}
          onRegister={(payload) => guardedAction(() => register(payload), 'No se pudo registrar el usuario')}
          onLogout={logout}
        />
        <Feed
          posts={posts}
          loading={loading}
          currentUser={currentUser}
          onLike={(id) => guardedAction(() => likePost(id), 'No se pudo dar like')}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          onOpenComments={setCommentsTarget}
          onComment={(payload) => guardedAction(async () => {
            if (!ensureSession()) return false;
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
            if (!ensureSession()) return false;
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
      {commentsTarget && (
        <CommentsDialog
          post={posts.find((post) => post.id === commentsTarget.id) || commentsTarget}
          currentUser={currentUser}
          onCancel={() => setCommentsTarget(null)}
          onComment={(payload) => guardedAction(async () => {
            if (!ensureSession()) return false;
            await createComment(payload);
            return true;
          }, 'No se pudo crear el comentario')}
          onDeleteComment={(postId, commentId) => guardedAction(() => deleteComment(postId, commentId), 'No se pudo eliminar el comentario')}
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

function Sidebar({ stats, currentUser, onLogin, onRegister, onLogout }) {
  return (
    <aside className="composer-panel" aria-label="Perfil y resumen">
      <AuthCard currentUser={currentUser} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} />
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
          <label className="file-picker">
            <span>Imagen desde tu computador</span>
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

function AuthCard({ currentUser, onLogin, onRegister, onLogout }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(emptyAuthForm);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await fileToDataUrl(file);
    updateField('avatar', dataUrl);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const action = isRegister ? onRegister : onLogin;
      const result = await action(form);
      if (result !== false) setForm(emptyAuthForm);
    } finally {
      setSubmitting(false);
    }
  };

  if (currentUser) {
    const initial = currentUser.nombre?.trim().charAt(0).toUpperCase() || 'U';

    return (
      <section className="profile-card">
        <div className="profile-preview">
          {currentUser.avatar ? (
            <img src={currentUser.avatar} alt="" className="avatar" />
          ) : (
            <div className="avatar avatar-fallback">{initial}</div>
          )}
          <div>
            <span className="eyebrow">Sesion activa</span>
            <h2>{currentUser.nombre}</h2>
            <p>{currentUser.email}</p>
          </div>
        </div>
        <button className="ghost-button profile-save" type="button" onClick={onLogout}>
          <i className="bi bi-box-arrow-right" />
          <span>Cerrar sesion</span>
        </button>
      </section>
    );
  }

  return (
    <section className="profile-card">
      <div className="profile-preview">
        <div className="avatar avatar-fallback"><i className="bi bi-person" /></div>
        <div>
          <span className="eyebrow">Cuenta</span>
          <h2>{isRegister ? 'Crear usuario' : 'Iniciar sesion'}</h2>
          <p>Accede con email y password para administrar tus publicaciones.</p>
        </div>
      </div>

      <div className="auth-tabs" role="tablist" aria-label="Modo de cuenta">
        <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => setMode('login')}>Login</button>
        <button className={mode === 'register' ? 'active' : ''} type="button" onClick={() => setMode('register')}>Registro</button>
      </div>

      <form className="composer-form compact-form" onSubmit={handleSubmit}>
        {isRegister && (
          <label>
            Nombre
            <input type="text" value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} placeholder="Ej: Camila Torres" required minLength="2" />
          </label>
        )}
        <label>
          Email
          <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="usuario@email.com" required />
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} placeholder="Minimo 4 caracteres" required minLength="4" />
        </label>
        {isRegister && (
          <>
            <label>
              Avatar
              <input type="url" value={form.avatar} onChange={(event) => updateField('avatar', event.target.value)} placeholder="https://..." />
            </label>
            <label className="file-picker">
              <span>Avatar desde tu computador</span>
              <input className="file-input" type="file" accept="image/*" onChange={handleAvatarFile} />
            </label>
          </>
        )}
        <button className="ghost-button profile-save" type="submit" disabled={submitting}>
          <i className={`bi ${isRegister ? 'bi-person-plus' : 'bi-box-arrow-in-right'}`} />
          <span>{submitting ? 'Procesando...' : (isRegister ? 'Crear cuenta' : 'Entrar')}</span>
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

function Feed({ posts, loading, currentUser, onLike, onEdit, onDelete, onOpenComments, onComment, onDeleteComment }) {
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
              currentUser={currentUser}
              onLike={onLike}
              onEdit={onEdit}
              onDelete={onDelete}
              onOpenComments={onOpenComments}
              onComment={onComment}
              onDeleteComment={onDeleteComment}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PostCard({ post, currentUser, onLike, onEdit, onDelete, onOpenComments, onComment, onDeleteComment }) {
  const comments = post.comentarios || [];
  const previewComments = comments.slice(-2);
  const user = post.usuario || post.autorNombre || 'Usuario';
  const avatar = post.avatar || post.autor?.avatar || '';
  const canManagePost = currentUser?.id && post.ownerId === currentUser.id;

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
        {canManagePost && (
          <div className="post-menu">
            <button className="icon-button soft" type="button" onClick={() => onEdit(post)} title="Editar">
              <i className="bi bi-pencil" />
            </button>
            <button className="icon-button danger-soft" type="button" onClick={() => onDelete(post)} title="Eliminar">
              <i className="bi bi-trash3" />
            </button>
          </div>
        )}
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
        {comments.length > 2 && (
          <button className="show-comments-button" type="button" onClick={() => onOpenComments(post)}>
            Ver todos los comentarios ({comments.length})
          </button>
        )}
        <ul>
          {previewComments.map((comment) => (
            <CommentItem key={comment.id} postId={post.id} comment={comment} currentUser={currentUser} onDelete={onDeleteComment} />
          ))}
        </ul>
        <CommentForm postId={post.id} onComment={onComment} />
      </section>
    </article>
  );
}

function CommentsDialog({ post, currentUser, onCancel, onComment, onDeleteComment }) {
  const comments = post.comentarios || [];
  const user = post.usuario || post.autorNombre || 'Usuario';
  const avatar = post.avatar || post.autor?.avatar || '';

  return (
    <div className="dialog-backdrop">
      <section className="dialog comments-dialog">
        <div className="dialog-header">
          <div>
            <span className="eyebrow">Comentarios</span>
            <h3>{comments.length} comentarios</h3>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} title="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <article className="modal-post">
          <header className="post-header">
            <div className="post-author">
              <img src={avatar} alt="" className="avatar" />
              <div>
                <h3>{user}</h3>
                <time>{formatDate(post.createdAt || Date.now())}</time>
              </div>
            </div>
          </header>
          <img className="post-image" src={post.url} alt={post.descripcion} />
          <div className="post-content">
            <p>{post.descripcion}</p>
          </div>
        </article>

        <section className="comments modal-comments">
          {comments.length === 0 ? (
            <p className="empty-comments">Aun no hay comentarios.</p>
          ) : (
            <ul>
              {comments.map((comment) => (
                <CommentItem key={comment.id} postId={post.id} comment={comment} currentUser={currentUser} onDelete={onDeleteComment} />
              ))}
            </ul>
          )}
          <CommentForm postId={post.id} onComment={onComment} />
        </section>
      </section>
    </div>
  );
}

function CommentItem({ postId, comment, currentUser, onDelete }) {
  const avatar = comment.avatar || comment.autor?.avatar || '';
  const user = comment.usuario || comment.autorNombre || 'Usuario';
  const canDelete = currentUser?.id && comment.ownerId === currentUser.id;

  return (
    <li className="comment-item">
      <img src={avatar} alt="" className="mini-avatar" />
      <div>
        <strong>{user}</strong>
        <p>{comment.texto}</p>
        <time>{formatDate(comment.createdAt)}</time>
      </div>
      {canDelete && (
        <button className="comment-delete" type="button" onClick={() => onDelete(postId, comment.id)} title="Eliminar comentario">
          <i className="bi bi-x-lg" />
        </button>
      )}
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
    url: post.url || '',
    descripcion: post.descripcion || '',
  });

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleImageFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await normalizeImageFile(file);
    updateField('url', dataUrl);
  };

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
            URL de imagen
            <input value={form.url} onChange={(event) => updateField('url', event.target.value)} type="url" required />
          </label>
          <label className="file-picker">
            <span>Imagen desde tu computador</span>
            <input className="file-input" type="file" accept="image/*" onChange={handleImageFile} />
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
