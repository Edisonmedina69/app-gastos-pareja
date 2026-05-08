import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase'; 
import { Home, Copy, Users, Plus, Check, Key } from 'lucide-react';
import '../Estilos/ConfiguracionHogar.css';

const ConfiguracionHogar = ({ usuario, onHogarCreado }) => { // <-- ¡AQUÍ ESTÁ LA MAGIA!
  const [espacioActual, setEspacioActual] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false); // Estado para el botón
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (usuario) {
      cargarEspacio();
    }
  }, [usuario]);

  const cargarEspacio = async () => {
    setCargando(true);
    try {
      const { data: relacion, error: errorRelacion } = await supabase
        .from('usuarios_espacios')
        .select('espacios(*)')
        .eq('usuario_id', usuario.id)
        .single();

      if (errorRelacion && errorRelacion.code !== 'PGRST116') throw errorRelacion;
      
      if (relacion && relacion.espacios) {
        setEspacioActual(relacion.espacios);
      }
    } catch (error) {
      console.error('Error al cargar espacio:', error.message);
    } finally {
      setCargando(false);
    }
  };

  const crearEspacio = async (e) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;

    setGuardando(true); // Bloqueamos el botón mientras trabaja
    try {
      // 1. Crear el espacio
      const { data: nuevoEspacio, error: errorEspacio } = await supabase
        .from('espacios')
        .insert([{ nombre: nuevoNombre.trim() }])
        .select()
        .single();

      if (errorEspacio) throw errorEspacio;

      // 2. Vincular al usuario como admin
      const { error: errorVinculo } = await supabase
        .from('usuarios_espacios')
        .insert([{ 
          usuario_id: usuario.id, 
          espacio_id: nuevoEspacio.id,
          rol: 'admin'
        }]);

      if (errorVinculo) throw errorVinculo;

      // 3. ¡AVISAMOS A APP.JSX QUE TERMINAMOS! 🚀
      if (onHogarCreado) {
        await onHogarCreado(nuevoEspacio);
      } else {
        setEspacioActual(nuevoEspacio);
      }
      setNuevoNombre('');
    } catch (error) {
      console.error('Error al crear espacio:', error.message);
      alert('Hubo un error al crear el hogar. Atendé la consola kapé.');
    } finally {
      setGuardando(false);
    }
  };

  const generarCodigoInvitacion = async () => {
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      const { data, error } = await supabase
        .from('espacios')
        .update({ codigo_invitacion: codigo })
        .eq('id', espacioActual.id)
        .select()
        .single();

      if (error) throw error;
      setEspacioActual(data);
    } catch (error) {
      console.error('Error al generar código:', error.message);
    }
  };

  const copiarCodigo = () => {
    if (!espacioActual?.codigo_invitacion) return;
    navigator.clipboard.writeText(espacioActual.codigo_invitacion);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (cargando) return <div className="pantalla-hogar"><div className="cargando">Cargando datos del hogar...</div></div>;

  return (
    <div className="pantalla-hogar">
      <div className="glass-container">
        <div className="header-hogar">
          <div className="icono-wrapper">
            <Home size={32} />
          </div>
          <h2>Configuración del Hogar</h2>
          <p>Gestioná tu espacio compartido para ÑandeFinanza</p>
        </div>

        {!espacioActual ? (
          <div className="crear-espacio-card">
            <Users size={48} className="icono-ilustracion" />
            <h3>Aún no tenés un hogar configurado</h3>
            <p>Creá un nuevo espacio para empezar a compartir tus finanzas.</p>
            
            <form onSubmit={crearEspacio} className="formulario-crear">
              <input
                type="text"
                placeholder="Ej: Familia Medina Valdez"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                required
                disabled={guardando}
              />
              <button type="submit" className="btn-primario" disabled={guardando}>
                <Plus size={18} />
                {guardando ? 'Guardando Hogar...' : 'Crear Hogar'}
              </button>
            </form>
          </div>
        ) : (
          <div className="detalle-espacio-card">
            <div className="info-hogar">
              <h3>{espacioActual.nombre}</h3>
              <span className="badge-rol">Administrador</span>
            </div>

            <div className="invitacion-section">
              <h4><Key size={18} /> Código de Invitación</h4>
              <p>Compartí este código para que tu pareja se una a este espacio.</p>
              
              {espacioActual.codigo_invitacion ? (
                <div className="codigo-box">
                  <span className="codigo-texto">{espacioActual.codigo_invitacion}</span>
                  <button onClick={copiarCodigo} className="btn-icon" title="Copiar código">
                    {copiado ? <Check size={20} color="#10b981" /> : <Copy size={20} />}
                  </button>
                </div>
              ) : (
                <button onClick={generarCodigoInvitacion} className="btn-secundario">
                  Generar Código
                </button>
              )}
            </div>
            {/* Botón extra por si App.jsx no recargó a tiempo, permite forzar la entrada */}
            <div style={{marginTop: '20px'}}>
               <button onClick={() => window.location.reload()} className="btn-primario" style={{background: '#10b981'}}>
                 Ir al Dashboard de Finanzas
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfiguracionHogar;