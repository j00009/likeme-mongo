$(document).ready(function () {
  $("form:first").submit(async (e) => {
    e.preventDefault();
    let usuario = $("form:first input:first").val();
    let URL = $("form:first input:last").val();
    let descripcion = $("form:first textarea").val();
    const { data } = await axios.post("/post", {
      usuario,
      URL,
      descripcion,
    });
    $("#creado").removeClass("d-none");
    getPosts();
  });
});
async function getPosts() {
  const { data } = await axios.get("/posts");

  data.sort((a, b) => {
    if (b.likes === a.likes) {
      // Para strings en JS, usamos localeCompare o comparaciones directas
      return a.id.localeCompare(b.id);
    }
    return b.likes - a.likes;
  });

  $(".posts").html("");
  $.each(data, (i, u) => {
    $(".posts").append(`

    `);
      $.each(data, (i, u) => {
  $(".posts").append(`
    <div class="card col-12 col-sm-4 d-inline mx-0 px-3 position-relative">
      <div class="card-body p-0">

        <!-- BOTÓN DELETE -->
        <button 
          class="btn btn-danger position-absolute top-0 end-0 m-2 rounded-circle"
          onclick="eliminar('${u.id}')"
          style="width:40px; height:40px; display:flex; align-items:center; justify-content:center;"
        >
          <i class="bi bi-trash"></i>
        </button>

        <img class="card-img-top" src="${u.url}" style="width: 100%" />

        <div class="p-3">
          <h4 class="card-title">${u.usuario}</h4>
          <p class="card-text">${u.descripcion}</p>
          
          <svg
            style="width: 50px; height: 50px; cursor: pointer;" 
            viewBox="0 0 24 24"
            onclick="like('${u.id}')"
          >
            <path
              fill="${u.likes ? 'red' : 'currentColor'}"
              d="${u.likes ?
        'M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z' :
        'M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55'}"
            />
          </svg>
          <h5 class="d-inline"> ${u.likes || 0} </h5>
        </div>
      </div>
    </div>
  `);
});
    
  });
  
}
getPosts()
function like(id) {
  axios.put(`/post?id=${id}`).then(() => {
    getPosts()
  })
}

function eliminar(id) {
  if (confirm("¿Seguro que quieres eliminar este post?")) {
    axios.delete(`/post-eliminar?id=${id}`).then(() => {
      getPosts();
    });
  }
}