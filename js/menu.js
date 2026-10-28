// Número predeterminado de preguntas a elegir si no se especifica
export const PREGUNTAS_POR_PRUEBA = 15;

/**
 * Carga directamente el archivo indice.json ubicado en la raíz del proyecto.
 * Esto garantiza que se respeten los títulos, el orden y las preguntas exactas que configuraste.
 */
export async function cargarTemas() {
  try {
    // La ruta debe ser 'indice.json' porque está en la raíz del repositorio
    const respuesta = await fetch('indice.json');
    
    if (!respuesta.ok) {
      throw new Error(`Error al cargar el índice: ${respuesta.statusText}`);
    }
    
    const datos = await respuesta.json();
    return datos.temas || [];
    
  } catch (error) {
    console.error("Error en cargarTemas:", error);
    return [];
  }
}
