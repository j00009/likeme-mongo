import React, { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';

const api = {
  posts: '/api/posts',
  postClusters: '/api/posts/clusters',
  followingPosts: '/api/posts/following',
  comments: '/api/comments',
  users: '/api/users',
};

const sessionStorageKey = 'likeme:session';
const themeStorageKey = 'likeme:theme';
const viewReportCooldownMs = 30 * 1000;
const viewReportDelayMs = 1000;
const viewReportCache = new Map();

const emptyPost = {
  URL: '',
  descripcion: '',
  type: 'image',
  tags: '',
};

const emptyAuthForm = {
  nombre: '',
  email: '',
  password: '',
  avatar: '',
  bio: '',
  interests: '',
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

const getStoredTheme = () => {
  try {
    return localStorage.getItem(themeStorageKey) || 'light';
  } catch (error) {
    return 'light';
  }
};

const splitTags = (value) => {
  if (Array.isArray(value)) return value;
  return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean);
};

const normalizeUrlInput = (value) => {
  const url = String(value || '').trim();
  if (!url || url.startsWith('data:') || url.startsWith('/') || /^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
};

const isDirectVideoUrl = (url) => {
  return /^data:video\//i.test(url) || /\.(m3u8|mov|mp4|mpeg|ogg|ogv|webm)(\?.*)?$/i.test(url);
};

const getYoutubeEmbedUrl = (url) => {
  try {
    const parsed = new URL(normalizeUrlInput(url));
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }

    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) return '';

    if (parsed.pathname.startsWith('/shorts/')) {
      const id = parsed.pathname.split('/').filter(Boolean)[1];
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }

    if (parsed.pathname.startsWith('/embed/')) return parsed.href;

    const id = parsed.searchParams.get('v');
    return id ? `https://www.youtube.com/embed/${id}` : '';
  } catch (error) {
    return '';
  }
};

const getInstagramEmbedUrl = (url) => {
  try {
    const parsed = new URL(normalizeUrlInput(url));
    const host = parsed.hostname.replace(/^www\./, '');
    if (!['instagram.com', 'm.instagram.com'].includes(host)) return '';

    const parts = parsed.pathname.split('/').filter(Boolean);
    const embedTypes = ['p', 'reel', 'tv'];
    if (!embedTypes.includes(parts[0]) || !parts[1]) return '';

    return `https://www.instagram.com/${parts[0]}/${parts[1]}/embed`;
  } catch (error) {
    return '';
  }
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
  const [allPosts, setAllPosts] = useState([]);
  const [followingPosts, setFollowingPosts] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('clusters');
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [commentsTarget, setCommentsTarget] = useState(null);
  const [profileTarget, setProfileTarget] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [session, setSession] = useState(getStoredSession);
  const [theme, setTheme] = useState(getStoredTheme);

  const currentUser = session?.user || null;
  const authToken = session?.token || '';
  const isDarkMode = theme === 'dark';

  const scopedPosts = useMemo(() => {
    if (!currentUser?.id) return allPosts;
    return allPosts.filter((post) => post.ownerId === currentUser.id);
  }, [allPosts, currentUser?.id]);

  const stats = useMemo(() => ({
    posts: scopedPosts.length,
    likes: scopedPosts.reduce((total, post) => total + (post.likes || 0), 0),
    comments: scopedPosts.reduce((total, post) => total + (post.comentarios?.length || 0), 0),
    views: scopedPosts.reduce((total, post) => total + (post.views || 0), 0),
  }), [scopedPosts]);

  const postsViewCluster = useMemo(() => {
    const totalLikes = scopedPosts.reduce((total, post) => total + (post.likes || 0), 0);
    const totalViews = scopedPosts.reduce((total, post) => total + (post.views || 0), 0);

    return {
      tag: 'selected-posts',
      title: currentUser ? `Posts de ${currentUser.nombre}` : 'Todos los posts',
      recommended: false,
      totalPosts: scopedPosts.length,
      totalLikes,
      totalViews,
      posts: scopedPosts,
    };
  }, [scopedPosts, currentUser]);

  const followingViewCluster = useMemo(() => {
    const totalLikes = followingPosts.reduce((total, post) => total + (post.likes || 0), 0);
    const totalViews = followingPosts.reduce((total, post) => total + (post.views || 0), 0);

    return {
      tag: 'following-posts',
      title: 'Siguiendo',
      recommended: false,
      totalPosts: followingPosts.length,
      totalLikes,
      totalViews,
      posts: followingPosts,
    };
  }, [followingPosts]);

  const visibleClusters = activeView === 'posts'
    ? [postsViewCluster]
    : activeView === 'following'
      ? [followingViewCluster]
      : clusters;
  const visiblePosts = activeView === 'posts'
    ? scopedPosts
    : activeView === 'following'
      ? followingPosts
      : posts;

  const notify = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  };

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  const saveSession = (nextSession) => {
    localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const updateSessionUser = (user) => {
    const nextSession = { ...session, user };
    saveSession(nextSession);
  };

  const replacePostInState = (updatedPost) => {
    setPosts((current) => current.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
    setAllPosts((current) => current.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
    setFollowingPosts((current) => current.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
    setProfileTarget((current) => current
      ? { ...current, posts: current.posts.map((post) => (post.id === updatedPost.id ? updatedPost : post)) }
      : current);
    setClusters((current) => current.map((cluster) => ({
      ...cluster,
      posts: (cluster.posts || []).map((post) => (post.id === updatedPost.id ? updatedPost : post)),
    })));
  };

  const removePostFromState = (postId) => {
    setPosts((current) => current.filter((post) => post.id !== postId));
    setAllPosts((current) => current.filter((post) => post.id !== postId));
    setFollowingPosts((current) => current.filter((post) => post.id !== postId));
    setProfileTarget((current) => current
      ? { ...current, posts: current.posts.filter((post) => post.id !== postId) }
      : current);
    setClusters((current) => current
      .map((cluster) => {
        const hadPost = (cluster.posts || []).some((post) => post.id === postId);
        return {
          ...cluster,
          posts: (cluster.posts || []).filter((post) => post.id !== postId),
          totalPosts: hadPost ? Math.max(0, (cluster.totalPosts || 0) - 1) : cluster.totalPosts,
        };
      })
      .filter((cluster) => cluster.posts.length > 0));
  };

  const logout = () => {
    localStorage.removeItem(sessionStorageKey);
    setSession(null);
    setActiveView('clusters');
    setFollowingPosts([]);
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
      const requests = [
        request(api.postClusters, {}, authToken),
        request(api.posts, {}, authToken),
      ];
      if (authToken) requests.push(request(api.followingPosts, {}, authToken));

      const [clusterData, postData, followingData = []] = await Promise.all(requests);
      setClusters(clusterData);
      setAllPosts(postData);
      setFollowingPosts(followingData);
      const uniquePosts = new Map();
      clusterData.forEach((cluster) => {
        (cluster.posts || []).forEach((post) => uniquePosts.set(post.id, post));
      });
      setPosts([...uniquePosts.values()]);
    } catch (error) {
      notify(error.message || 'No se pudieron cargar los posts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
    setActiveView('clusters');
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;

    request(`${api.users}/me`, {}, authToken)
      .then((user) => updateSessionUser(user))
      .catch(() => logout());
  }, [authToken]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const createPost = async (payload) => {
    await request(api.posts, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, authToken);

    await loadPosts();
    notify('Publicacion creada');
  };

  const updatePost = async (id, payload) => {
    const data = await request(`${api.posts}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, authToken);

    replacePostInState(data);
    setEditTarget(null);
    notify('Publicacion actualizada');
  };

  const updateProfile = async (payload) => {
    const user = await request(`${api.users}/me`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, authToken);

    updateSessionUser(user);
    setProfileTarget((current) => (current
      ? { ...current, user: { ...current.user, ...user } }
      : current));
    setProfileEditorOpen(false);
    await loadPosts();
    notify('Perfil actualizado');
  };

  const openProfile = async (userId) => {
    if (!userId) return;

    setActiveView('profile');
    setProfileLoading(true);
    setProfileTarget(null);
    try {
      const [user, userPosts] = await Promise.all([
        request(`${api.users}/${userId}`, {}, authToken),
        request(`${api.posts}/user/${userId}`, {}, authToken),
      ]);
      setProfileTarget({ user, posts: userPosts });
    } catch (error) {
      notify(error.message || 'No se pudo cargar el perfil', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const toggleFollow = async (userId) => {
    if (!currentUser) {
      notify('Inicia sesion para seguir usuarios', 'error');
      return false;
    }

    const isFollowing = (currentUser.following || []).includes(userId);
    const user = await request(`${api.users}/${userId}/${isFollowing ? 'unfollow' : 'follow'}`, {
      method: 'PATCH',
    }, authToken);

    updateSessionUser(user);
    await loadPosts();
    notify(isFollowing ? 'Dejaste de seguir este perfil' : 'Ahora sigues este perfil');
    return true;
  };

  const likePost = async (id) => {
    const data = await request(`${api.posts}/${id}/like`, { method: 'PATCH' }, authToken);
    replacePostInState(data);
  };

  const viewPost = async (id) => {
    const data = await request(`${api.posts}/${id}/view`, { method: 'PATCH' }, authToken);
    replacePostInState(data);
  };

  const deletePost = async () => {
    if (!deleteTarget) return;

    await request(`${api.posts}/${deleteTarget.id}`, { method: 'DELETE' }, authToken);
    removePostFromState(deleteTarget.id);
    setDeleteTarget(null);
    notify('Publicacion eliminada');
  };

  const createComment = async (payload) => {
    const data = await request(api.comments, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, authToken);

    const addComment = (post) => {
      if (post.id !== payload.post) return post;

      return {
        ...post,
        comentarios: [...(post.comentarios || []), data],
      };
    };

    setPosts((current) => current.map(addComment));
    setAllPosts((current) => current.map(addComment));
    setFollowingPosts((current) => current.map(addComment));
    setProfileTarget((current) => current
      ? { ...current, posts: current.posts.map(addComment) }
      : current);
    setClusters((current) => current.map((cluster) => ({
      ...cluster,
      posts: (cluster.posts || []).map(addComment),
    })));
    notify('Comentario agregado');
  };

  const deleteComment = async (postId, commentId) => {
    await request(`${api.comments}/${commentId}`, { method: 'DELETE' }, authToken);
    const removeComment = (post) => {
      if (post.id !== postId) return post;

      return {
        ...post,
        comentarios: (post.comentarios || []).filter((comment) => comment.id !== commentId),
      };
    };

    setPosts((current) => current.map(removeComment));
    setAllPosts((current) => current.map(removeComment));
    setFollowingPosts((current) => current.map(removeComment));
    setProfileTarget((current) => current
      ? { ...current, posts: current.posts.map(removeComment) }
      : current);
    setClusters((current) => current.map((cluster) => ({
      ...cluster,
      posts: (cluster.posts || []).map(removeComment),
    })));
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
      <Navbar
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        onRefresh={loadPosts}
        onOpenComposer={() => setComposerOpen(true)}
      />
      <main className="app-shell">
        <Sidebar
          stats={stats}
          activeView={activeView}
          currentUser={currentUser}
          onShowPosts={() => setActiveView('posts')}
          onEditProfile={() => setProfileEditorOpen(true)}
          onOpenProfile={() => currentUser?.id && openProfile(currentUser.id)}
          onLogin={(payload) => guardedAction(() => login(payload), 'No se pudo iniciar sesion')}
          onRegister={(payload) => guardedAction(() => register(payload), 'No se pudo registrar el usuario')}
          onLogout={logout}
        />
        {activeView !== 'profile' && (
          <Feed
            posts={visiblePosts}
            clusters={visibleClusters}
            loading={loading}
            currentUser={currentUser}
            activeView={activeView}
            onShowClusters={() => setActiveView('clusters')}
            onShowFollowing={() => {
              if (!ensureSession()) return;
              setActiveView('following');
            }}
            onLike={(id) => guardedAction(async () => {
              if (!ensureSession()) return false;
              await likePost(id);
              return true;
            }, 'No se pudo dar like')}
            onView={(id) => guardedAction(() => viewPost(id), 'No se pudo registrar la vista')}
            onEdit={setEditTarget}
            onDelete={setDeleteTarget}
            onOpenComments={setCommentsTarget}
            onOpenProfile={openProfile}
            onComment={(payload) => guardedAction(async () => {
              if (!ensureSession()) return false;
              await createComment(payload);
              return true;
            }, 'No se pudo crear el comentario')}
            onDeleteComment={(postId, commentId) => guardedAction(() => deleteComment(postId, commentId), 'No se pudo eliminar el comentario')}
          />
        )}
        {activeView === 'profile' && (
          <ProfileView
            profile={profileTarget}
            loading={profileLoading}
            currentUser={currentUser}
            onBack={() => setActiveView('clusters')}
            onEditProfile={() => setProfileEditorOpen(true)}
            onFollow={(userId) => guardedAction(() => toggleFollow(userId), 'No se pudo actualizar el seguimiento')}
            onLike={(id) => guardedAction(async () => {
              if (!ensureSession()) return false;
              await likePost(id);
              return true;
            }, 'No se pudo dar like')}
            onView={(id) => guardedAction(() => viewPost(id), 'No se pudo registrar la vista')}
            onEdit={setEditTarget}
            onDelete={setDeleteTarget}
            onOpenComments={setCommentsTarget}
            onOpenProfile={openProfile}
            onComment={(payload) => guardedAction(async () => {
              if (!ensureSession()) return false;
              await createComment(payload);
              return true;
            }, 'No se pudo crear el comentario')}
            onDeleteComment={(postId, commentId) => guardedAction(() => deleteComment(postId, commentId), 'No se pudo eliminar el comentario')}
          />
        )}
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
      {profileEditorOpen && currentUser && (
        <EditProfileDialog
          user={currentUser}
          onCancel={() => setProfileEditorOpen(false)}
          onSave={(payload) => guardedAction(() => updateProfile(payload), 'No se pudo actualizar el perfil')}
        />
      )}
      {commentsTarget && (
        <CommentsDialog
          post={allPosts.find((post) => post.id === commentsTarget.id) || commentsTarget}
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

function Navbar({ isDarkMode, onToggleTheme, onRefresh, onOpenComposer }) {
  return (
    <nav className="topbar">
      <a className="brand" href="/">
        <span className="brand-mark"><i className="bi bi-heart-fill" /></span>
        <span>Like Me</span>
        <small>Clusters</small>
      </a>
      <div className="topbar-actions">
        <button className="theme-toggle" type="button" onClick={onToggleTheme} title="Cambiar tema">
          <span className="theme-toggle-track">
            <i className={`bi ${isDarkMode ? 'bi-moon-stars-fill' : 'bi-sun-fill'}`} />
          </span>
          <span>{isDarkMode ? 'Dark' : 'Light'}</span>
        </button>
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

function Sidebar({ stats, activeView, currentUser, onShowPosts, onEditProfile, onOpenProfile, onLogin, onRegister, onLogout }) {
  return (
    <aside className="composer-panel" aria-label="Perfil y resumen">
      <AuthCard currentUser={currentUser} onEditProfile={onEditProfile} onOpenProfile={onOpenProfile} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} />
      <section className="stats-panel" aria-label="Resumen">
        <Stat value={stats.posts} label="posts" onClick={onShowPosts} active={activeView === 'posts'} />
        <Stat value={stats.likes} label="likes" />
        <Stat value={stats.views} label="views" />
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

    const dataUrl = file.type.startsWith('image/')
      ? await normalizeImageFile(file)
      : await fileToDataUrl(file);
    updateField('URL', dataUrl);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const created = await onCreate({
        ...form,
        URL: normalizeUrlInput(form.URL),
        mediaUrl: normalizeUrlInput(form.URL),
        tags: splitTags(form.tags),
      });
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
            Tipo de contenido
            <select value={form.type} onChange={(event) => updateField('type', event.target.value)}>
              <option value="image">Imagen</option>
              <option value="video">Video</option>
              <option value="reel">Reel</option>
              <option value="text">Texto</option>
            </select>
          </label>
          <label>
            URL multimedia
            <input id="post-url" type="text" value={form.URL} onChange={(event) => updateField('URL', event.target.value)} placeholder="https://youtube.com/shorts/... o https://sitio.com/video.mp4" required={form.type !== 'text'} />
          </label>
          <label className="file-picker">
            <span>Archivo desde tu computador</span>
            <input className="file-input" type="file" accept="image/*,video/*" onChange={handleImageFile} />
          </label>
          <label>
            Tags
            <input type="text" value={form.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="mongo, reels, viajes" />
          </label>
          {form.URL && (
            <div className="image-preview">
              <MediaPreview post={{ mediaUrl: form.URL, type: form.type, descripcion: form.descripcion }} />
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

function AuthCard({ currentUser, onEditProfile, onOpenProfile, onLogin, onRegister, onLogout }) {
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
      const result = await action({
        ...form,
        avatar: normalizeUrlInput(form.avatar),
        interests: splitTags(form.interests),
      });
      if (result !== false) setForm(emptyAuthForm);
    } finally {
      setSubmitting(false);
    }
  };

  if (currentUser) {
    return (
      <section className="profile-card">
        <div className="profile-preview">
          <Avatar src={currentUser.avatar} name={currentUser.nombre} className="avatar" />
          <div>
            <span className="eyebrow">Sesion activa</span>
            <h2>{currentUser.nombre}</h2>
            <p>{currentUser.email}</p>
            {currentUser.bio && <p>{currentUser.bio}</p>}
          </div>
        </div>
        <div className="tag-list profile-tags">
          <span className="type-chip">{currentUser.role || 'user'}</span>
          {(currentUser.interests || []).map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
        <div className="profile-actions">
          <button className="ghost-button profile-action" type="button" onClick={onOpenProfile}>
            <i className="bi bi-person-lines-fill" />
            <span>Ver perfil</span>
          </button>
          <button className="ghost-button profile-action" type="button" onClick={onEditProfile}>
            <i className="bi bi-pencil-square" />
            <span>Editar perfil</span>
          </button>
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
              <input type="text" value={form.avatar} onChange={(event) => updateField('avatar', event.target.value)} placeholder="https://..." />
            </label>
            <label>
              Bio
              <textarea value={form.bio} onChange={(event) => updateField('bio', event.target.value)} rows="3" placeholder="Perfil breve" maxLength="180" />
            </label>
            <label>
              Intereses
              <input type="text" value={form.interests} onChange={(event) => updateField('interests', event.target.value)} placeholder="mongo, musica, videos" />
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

function Stat({ value, label, onClick, active = false }) {
  if (onClick) {
    return (
      <button className={`stat-card ${active ? 'active' : ''}`} type="button" onClick={onClick}>
        <strong>{value}</strong>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Feed({ posts, clusters, loading, currentUser, activeView, onShowClusters, onShowFollowing, onLike, onView, onEdit, onDelete, onOpenComments, onOpenProfile, onComment, onDeleteComment }) {
  return (
    <section className="feed-section clustered-feed" aria-label="Feed por clusters">
      <div className="feed-header">
        <div>
          <span className="eyebrow">{activeView === 'posts' ? 'Vista de posts' : 'Clusters dinamicos'}</span>
          <h2>{activeView === 'posts' ? (currentUser ? 'Tus publicaciones' : 'Todas las publicaciones') : (currentUser ? 'Explora segun tus intereses' : 'Explora por tags')}</h2>
        </div>
        <div className="feed-header-actions">
          {currentUser && (
            <button className={`ghost-button compact ${activeView === 'following' ? 'active' : ''}`} type="button" onClick={onShowFollowing}>
              <i className="bi bi-people" />
              <span>Siguiendo</span>
            </button>
          )}
          {activeView !== 'clusters' && (
            <button className="ghost-button compact" type="button" onClick={onShowClusters}>
              <i className="bi bi-arrow-left" />
              <span>Volver</span>
            </button>
          )}
          <div className="feed-status">{loading ? 'Cargando...' : 'Sincronizado'}</div>
        </div>
      </div>

      {loading && (
        <div className="cluster-list">
          <div className="cluster-shell">
            <div className="cluster-header skeleton-line" />
            <div className="cluster-row">
              <div className="skeleton-card compact" />
              <div className="skeleton-card compact" />
              <div className="skeleton-card compact" />
            </div>
          </div>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="empty-state">
          <i className="bi bi-images" />
          <h3>Aun no hay publicaciones</h3>
          <p>Crea el primer post para iniciar el feed.</p>
        </div>
      )}

      {!loading && posts.length > 0 && clusters.length > 0 && (
        <div className="cluster-list">
          {clusters.map((cluster) => (
            <section className="cluster-shell" key={cluster.tag}>
              <div className="cluster-header">
                <div>
                  <span className="eyebrow">{cluster.recommended ? 'Recomendado' : 'Tag activo'}</span>
                  <h3>{cluster.title}</h3>
                </div>
                <div className="cluster-meta">
                  <span>{cluster.totalPosts} posts</span>
                  <span>{cluster.totalLikes || 0} likes</span>
                  <span>{cluster.totalViews || 0} views</span>
                </div>
              </div>
              <div className="cluster-row" aria-label={`Posts del cluster ${cluster.tag}`}>
                {(cluster.posts || []).map((post) => (
                  <PostCard
                    key={`${cluster.tag}-${post.id}`}
                    post={post}
                    currentUser={currentUser}
                    onLike={onLike}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onOpenComments={onOpenComments}
                    onOpenProfile={onOpenProfile}
                    onComment={onComment}
                    onDeleteComment={onDeleteComment}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function PostCard({ post, currentUser, onLike, onView, onEdit, onDelete, onOpenComments, onOpenProfile, onComment, onDeleteComment }) {
  const comments = post.comentarios || [];
  const previewComments = comments.slice(-2);
  const user = post.usuario || post.autorNombre || 'Usuario';
  const avatar = post.avatar || post.autor?.avatar || '';
  const canManagePost = currentUser?.id && post.ownerId === currentUser.id;
  const articleRef = useRef(null);

  useEffect(() => {
    const element = articleRef.current;
    if (!element || !currentUser?.id) return undefined;

    let viewTimer = null;

    const clearViewTimer = () => {
      if (viewTimer) {
        clearTimeout(viewTimer);
        viewTimer = null;
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || entry.intersectionRatio < 0.6) {
        clearViewTimer();
        return;
      }

      clearViewTimer();
      viewTimer = setTimeout(() => {
        const cacheKey = `${currentUser.id}:${post.id}`;
        const lastReport = viewReportCache.get(cacheKey) || 0;
        if (Date.now() - lastReport < viewReportCooldownMs) return;

        viewReportCache.set(cacheKey, Date.now());
        onView(post.id);
      }, viewReportDelayMs);
    }, { threshold: [0, 0.6, 1] });

    observer.observe(element);

    return () => {
      clearViewTimer();
      observer.disconnect();
    };
  }, [currentUser?.id, post.id, onView]);

  return (
    <article className="post-card" ref={articleRef}>
      <header className="post-header">
        <div className="post-author">
          <Avatar src={avatar} name={user} className="avatar" />
          <div>
            <button className="author-button" type="button" onClick={() => onOpenProfile?.(post.ownerId)}>
              {user}
            </button>
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

      <MediaPreview post={post} />

      <div className="post-content">
        <p>{post.descripcion}</p>
        <div className="tag-list">
          <span className="type-chip">{post.type || 'image'}</span>
          {(post.tags || []).map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
        <div className="post-actions">
          <button
            className={`like-button ${post.likedByCurrentUser ? 'liked' : ''}`}
            type="button"
            onClick={() => onLike(post.id)}
            disabled={Boolean(post.likedByCurrentUser)}
            title={post.likedByCurrentUser ? 'Ya diste like' : 'Dar like'}
          >
            <i className="bi bi-heart-fill" />
            <span>{post.likes || 0}</span>
          </button>
          <span className="comment-count">
            <i className="bi bi-chat-dots" />
            {comments.length}
          </span>
          <span className="comment-count">
            <i className="bi bi-eye" />
            {post.views || 0}
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

function Avatar({ src, name, className }) {
  const [failed, setFailed] = useState(false);
  const initial = name?.trim().charAt(0).toUpperCase() || 'U';
  const normalizedSrc = normalizeUrlInput(src);

  useEffect(() => {
    setFailed(false);
  }, [normalizedSrc]);

  if (!normalizedSrc || failed) {
    return <div className={`${className} avatar-fallback`}>{initial}</div>;
  }

  return (
    <img
      src={normalizedSrc}
      alt=""
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function MediaPreview({ post }) {
  const mediaUrl = normalizeUrlInput(post.mediaUrl || post.url || '');
  const type = post.type || (mediaUrl ? 'image' : 'text');
  const youtubeEmbedUrl = getYoutubeEmbedUrl(mediaUrl);
  const instagramEmbedUrl = getInstagramEmbedUrl(mediaUrl);

  if (type === 'text' || !mediaUrl) {
    return (
      <div className="text-post-media">
        <i className="bi bi-card-text" />
        <span>{post.descripcion}</span>
      </div>
    );
  }

  if (youtubeEmbedUrl) {
    return (
      <div className={`embed-frame ${type === 'reel' ? 'reel-frame' : ''}`}>
        <iframe
          src={youtubeEmbedUrl}
          title={post.descripcion || 'Contenido de YouTube'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
        <span className="media-badge">
          <i className="bi bi-youtube" />
          youtube
        </span>
      </div>
    );
  }

  if (instagramEmbedUrl) {
    return (
      <div className={`embed-frame instagram-frame ${type === 'reel' ? 'reel-frame' : ''}`}>
        <iframe
          src={instagramEmbedUrl}
          title={post.descripcion || 'Contenido de Instagram'}
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
        <span className="media-badge">
          <i className="bi bi-instagram" />
          instagram
        </span>
      </div>
    );
  }

  if (type === 'video' || type === 'reel') {
    if (!isDirectVideoUrl(mediaUrl)) {
      return <ExternalMediaLink url={mediaUrl} type={type} title={post.descripcion} />;
    }

    return (
      <div className={`video-frame ${type === 'reel' ? 'reel-frame' : ''}`}>
        <video className="post-image" src={mediaUrl} controls muted playsInline />
        <span className="media-badge">
          <i className={`bi ${type === 'reel' ? 'bi-phone' : 'bi-play-btn'}`} />
          {type}
        </span>
      </div>
    );
  }

  return (
    <RemoteImage
      src={mediaUrl}
      alt={post.descripcion}
      fallback={<ExternalMediaLink url={mediaUrl} type={type} title={post.descripcion} />}
    />
  );
}

function ExternalMediaLink({ url, type, title }) {
  const normalizedUrl = normalizeUrlInput(url);

  return (
    <a className="external-media-card" href={normalizedUrl} target="_blank" rel="noreferrer">
      <i className="bi bi-box-arrow-up-right" />
      <span className="media-badge">
        <i className="bi bi-link-45deg" />
        {type}
      </span>
      <strong>{title || 'Abrir contenido externo'}</strong>
      <small>{normalizedUrl}</small>
    </a>
  );
}

function RemoteImage({ src, alt, fallback }) {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = normalizeUrlInput(src);

  useEffect(() => {
    setFailed(false);
  }, [normalizedSrc]);

  if (!normalizedSrc || failed) return fallback;

  return (
    <img
      className="post-image"
      src={normalizedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function ProfileView({ profile, loading, currentUser, onBack, onEditProfile, onFollow, onLike, onView, onEdit, onDelete, onOpenComments, onOpenProfile, onComment, onDeleteComment }) {
  const user = profile?.user;
  const posts = profile?.posts || [];
  const isOwnProfile = currentUser?.id && user?.id === currentUser.id;
  const isFollowing = Boolean(user?.id && (currentUser?.following || []).includes(user.id));

  return (
    <section className="feed-section profile-view" aria-label="Vista de perfil">
      <div className="feed-header">
        <div className="dialog-header">
          <div>
            <span className="eyebrow">Perfil</span>
            <h3>{loading ? 'Cargando perfil...' : user?.nombre}</h3>
          </div>
          <button className="ghost-button compact" type="button" onClick={onBack}>
            <i className="bi bi-arrow-left" />
            <span>Volver</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="empty-state compact-state">
          <i className="bi bi-person" />
          <p>Cargando informacion del perfil.</p>
        </div>
      )}

      {!loading && user && (
        <>
          <section className="profile-hero">
            <Avatar src={user.avatar} name={user.nombre} className="profile-avatar" />
            <div>
              <h2>{user.nombre}</h2>
              <p>{user.bio || 'Sin bio todavia.'}</p>
              <div className="profile-metrics">
                <span>{posts.length} posts</span>
                <span>{(user.following || []).length} siguiendo</span>
              </div>
            </div>
            {isOwnProfile ? (
              <button className="primary-button" type="button" onClick={onEditProfile}>
                <i className="bi bi-pencil" />
                <span>Editar perfil</span>
              </button>
            ) : (
              <button className={`primary-button follow-button ${isFollowing ? 'following' : ''}`} type="button" onClick={() => onFollow(user.id)}>
                <i className={`bi ${isFollowing ? 'bi-person-check' : 'bi-person-plus'}`} />
                <span>{isFollowing ? 'Siguiendo' : 'Seguir'}</span>
              </button>
            )}
          </section>

          {(user.interests || []).length > 0 && (
            <div className="tag-list profile-tags">
              {(user.interests || []).map((tag) => <span key={tag}>#{tag}</span>)}
            </div>
          )}

          <section className="profile-posts">
            <div className="cluster-header flat">
              <div>
                <span className="eyebrow">Publicaciones</span>
                <h3>{posts.length} posts</h3>
              </div>
            </div>
            {posts.length === 0 ? (
              <div className="empty-state compact-state">
                <i className="bi bi-images" />
                <p>Este perfil aun no tiene publicaciones.</p>
              </div>
            ) : (
              <div className="cluster-row profile-row">
                {posts.map((post) => (
                  <PostCard
                    key={`profile-${post.id}`}
                    post={post}
                    currentUser={currentUser}
                    onLike={onLike}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onOpenComments={onOpenComments}
                    onOpenProfile={onOpenProfile}
                    onComment={onComment}
                    onDeleteComment={onDeleteComment}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
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
              <Avatar src={avatar} name={user} className="avatar" />
              <div>
                <h3>{user}</h3>
                <time>{formatDate(post.createdAt || Date.now())}</time>
              </div>
            </div>
          </header>
          <MediaPreview post={post} />
          <div className="post-content">
            <p>{post.descripcion}</p>
            <div className="tag-list">
              <span className="type-chip">{post.type || 'image'}</span>
              {(post.tags || []).map((tag) => <span key={tag}>#{tag}</span>)}
            </div>
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

function EditProfileDialog({ user, onCancel, onSave }) {
  const [form, setForm] = useState({
    nombre: user.nombre || '',
    avatar: user.avatar || '',
    bio: user.bio || '',
    interests: (user.interests || []).join(', '),
  });
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    updateField('avatar', await fileToDataUrl(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await onSave({
        ...form,
        avatar: normalizeUrlInput(form.avatar),
        interests: splitTags(form.interests),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dialog-backdrop">
      <section className="dialog edit-dialog">
        <h3>Editar perfil</h3>
        <form className="composer-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} type="text" required minLength="2" maxLength="60" />
          </label>
          <label>
            Avatar
            <input value={form.avatar} onChange={(event) => updateField('avatar', event.target.value)} type="text" placeholder="https://..." />
          </label>
          <label className="file-picker">
            <span>Avatar desde tu computador</span>
            <input className="file-input" type="file" accept="image/*" onChange={handleAvatarFile} />
          </label>
          <label>
            Bio
            <textarea value={form.bio} onChange={(event) => updateField('bio', event.target.value)} rows="3" maxLength="180" />
          </label>
          <label>
            Intereses
            <input value={form.interests} onChange={(event) => updateField('interests', event.target.value)} type="text" placeholder="mongo, musica, videos" />
          </label>
          <div className="dialog-actions">
            <button className="ghost-button" type="button" onClick={onCancel}>Cancelar</button>
            <button className="submit-button compact" type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
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
      <Avatar src={avatar} name={user} className="mini-avatar" />
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
    type: post.type || 'image',
    tags: (post.tags || []).join(', '),
  });

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleImageFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = file.type.startsWith('image/')
      ? await normalizeImageFile(file)
      : await fileToDataUrl(file);
    updateField('url', dataUrl);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSave(post.id, {
      ...form,
      url: normalizeUrlInput(form.url),
      mediaUrl: normalizeUrlInput(form.url),
      tags: splitTags(form.tags),
    });
  };

  return (
    <div className="dialog-backdrop">
      <section className="dialog edit-dialog">
        <h3>Editar publicacion</h3>
        <form className="composer-form" onSubmit={handleSubmit}>
          <label>
            Tipo de contenido
            <select value={form.type} onChange={(event) => updateField('type', event.target.value)}>
              <option value="image">Imagen</option>
              <option value="video">Video</option>
              <option value="reel">Reel</option>
              <option value="text">Texto</option>
            </select>
          </label>
          <label>
            URL multimedia
            <input value={form.url} onChange={(event) => updateField('url', event.target.value)} type="text" required={form.type !== 'text'} />
          </label>
          <label className="file-picker">
            <span>Archivo desde tu computador</span>
            <input className="file-input" type="file" accept="image/*,video/*" onChange={handleImageFile} />
          </label>
          <label>
            Tags
            <input value={form.tags} onChange={(event) => updateField('tags', event.target.value)} type="text" placeholder="mongo, reels, datos" />
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

export default App;
