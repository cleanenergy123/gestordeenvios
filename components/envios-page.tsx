'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

const supabase = createClient('https://ldqlnkvkzeefungcrwvc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkcWxua3ZremVlZnVuZ2Nyd3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjkyNTcwNDgsImV4cCI6MjA0NDgzMzA0OH0.s4z0DQiPVLIHGChCpDriGtjJK78tClx_Pw4zP9IlIRI')

const zonas = [
  { nombre: 'CABA', precio: 3218 },
  { nombre: 'GBA1', precio: 4979 },
  { nombre: 'GBA2', precio: 6859 },
]

export function EnviosPageComponent() {
  const [enviosFlex, setEnviosFlex] = useState([])
  const [enviosMercadoLibre, setEnviosMercadoLibre] = useState([])
  const [enviosPorSemana, setEnviosPorSemana] = useState({})
  const [productos, setProductos] = useState([])
  const [filtroSKU, setFiltroSKU] = useState('')
  const [currentTab, setCurrentTab] = useState('flex')
  const [currentPageFlex, setCurrentPageFlex] = useState(0)
  const [currentPageML, setCurrentPageML] = useState(0)
  const [productosPage, setProductosPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const productosPerPage = 10
  const { toast } = useToast()

  useEffect(() => {
    fetchEnvios()
    fetchProductos()
  }, [])

  const fetchEnvios = async () => {
    setIsLoading(true)
    try {
      console.log('Fetching envios...')
      const { data: flexData, error: flexError } = await supabase
        .from('envios_flex')
        .select('*')
      
      const { data: mlData, error: mlError } = await supabase
        .from('envios_mercado_libre')
        .select('*')

      if (flexError) throw new Error(`Error fetching envios flex: ${flexError.message}`)
      if (mlError) throw new Error(`Error fetching envios mercado libre: ${mlError.message}`)

      console.log('Envíos Flex:', flexData)
      console.log('Envíos Mercado Libre:', mlData)

      setEnviosFlex(flexData || [])
      setEnviosMercadoLibre(mlData || [])

      organizarEnviosPorSemana(flexData || [], mlData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Hubo un problema al cargar los datos de envíos. Por favor, intente de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProductos = async () => {
    setIsLoading(true)
    try {
      console.log('Fetching productos...')
      const { data, error } = await supabase
        .from('products_cost')
        .select('*')

      if (error) throw error

      console.log('Productos:', data)

      setProductos(data || [])
    } catch (error) {
      console.error('Error fetching productos:', error)
      toast({
        title: "Error",
        description: "Hubo un problema al cargar los productos. Por favor, intente de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const organizarEnviosPorSemana = (flexEnvios, mlEnvios) => {
    console.log('Organizando envíos por semana...')
    const organizarPorSemana = (envios) => {
      return envios.reduce((acc, envio) => {
        const fecha = new Date(envio.fecha)
        const semana = obtenerSemanaEspanol(fecha)
        if (!acc[semana]) {
          acc[semana] = {
            envios: [],
            costoTotal: 0
          }
        }
        acc[semana].envios.push(envio)
        acc[semana].costoTotal += envio.precio || envio.costo || 0
        return acc
      }, {})
    }

    const enviosPorSemanaOrganizados = {
      flex: organizarPorSemana(flexEnvios),
      ml: organizarPorSemana(mlEnvios)
    }

    console.log('Envíos organizados por semana:', enviosPorSemanaOrganizados)

    setEnviosPorSemana(enviosPorSemanaOrganizados)
  }

  const obtenerSemanaEspanol = (fecha) => {
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' }
    const primerDiaSemana = new Date(fecha.setDate(fecha.getDate() - fecha.getDay() + 1))
    const ultimoDiaSemana = new Date(fecha.setDate(fecha.getDate() - fecha.getDay() + 7))
    return `${primerDiaSemana.toLocaleDateString('es-ES', opciones)} - ${ultimoDiaSemana.toLocaleDateString('es-ES', opciones)}`
  }

  const handleSubmitFlex = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const nuevoEnvio = Object.fromEntries(formData)
    
    const camposRequeridos = ['fecha', 'nro_venta', 'producto', 'estado', 'ubicacion', 'zona']
    const camposFaltantes = camposRequeridos.filter(campo => !nuevoEnvio[campo])
    
    if (camposFaltantes.length > 0) {
      toast({
        title: "Error",
        description: `Faltan los siguientes campos: ${camposFaltantes.join(', ')}`,
        variant: "destructive",
      })
      return
    }

    const zonaSeleccionada = zonas.find(z => z.nombre === nuevoEnvio.zona)
    if (zonaSeleccionada) {
      nuevoEnvio.precio = zonaSeleccionada.precio
    }

    try {
      const { data, error } = await supabase
        .from('envios_flex')
        .insert([nuevoEnvio])
        .select()

      if (error) throw error

      console.log('Nuevo envío Flex agregado:', data)

      const updatedEnviosFlex = [...enviosFlex, data[0]]
      setEnviosFlex(updatedEnviosFlex)
      organizarEnviosPorSemana(updatedEnviosFlex, enviosMercadoLibre)
      toast({
        title: "Éxito",
        description: "Envío Flex agregado correctamente.",
      })
      e.target.reset()
    } catch (error) {
      console.error('Error inserting envio flex:', error)
      toast({
        title: "Error",
        description: "No se pudo agregar el envío Flex. Por favor, intente de nuevo.",
        variant: "destructive",
      })
    }
  }

  const handleSubmitML = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const nuevoEnvio = Object.fromEntries(formData)
    
    try {
      const { data, error } = await supabase
        .from('envios_mercado_libre')
        .insert([nuevoEnvio])
        .select()

      if (error) throw error

      console.log('Nuevo envío Mercado Libre agregado:', data)

      const updatedEnviosMercadoLibre = [...enviosMercadoLibre, data[0]]
      setEnviosMercadoLibre(updatedEnviosMercadoLibre)
      organizarEnviosPorSemana(enviosFlex, updatedEnviosMercadoLibre)
      toast({
        title: "Éxito",
        description: "Envío Mercado Libre agregado correctamente.",
      })
      e.target.reset()
    } catch (error) {
      console.error('Error inserting envio mercado libre:', error)
      toast({
        title: "Error",
        description: "No se pudo agregar el envío Mercado Libre. Por favor, intente de nuevo.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateEstado = async (id, nuevoEstado, tipoEnvio) => {
    try {
      const { error } = await supabase
        .from(tipoEnvio === 'flex' ? 'envios_flex' : 'envios_mercado_libre')
        .update({ estado: nuevoEstado })
        .eq('id', id)

      if (error) throw error

      if (tipoEnvio === 'flex') {
        const updatedEnviosFlex = enviosFlex.map(envio =>
          envio.id === id ? { ...envio, estado: nuevoEstado } : envio
        )
        setEnviosFlex(updatedEnviosFlex)
        organizarEnviosPorSemana(updatedEnviosFlex, enviosMercadoLibre)
      } else {
        const updatedEnviosMercadoLibre = enviosMercadoLibre.map(envio =>
          envio.id === id ? { ...envio, estado: nuevoEstado } : envio
        )
        setEnviosMercadoLibre(updatedEnviosMercadoLibre)
        organizarEnviosPorSemana(enviosFlex, updatedEnviosMercadoLibre)
      }

      console.log(`Estado del envío ${id} actualizado a ${nuevoEstado}`)

      toast({
        title: "Éxito",
        description: "Estado del envío actualizado correctamente.",
      })
    } catch (error) {
      console.error('Error updating envio estado:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del envío. Por favor, intente de nuevo.",
        variant: "destructive",
      })
    }
  }

  const handleCopyPrecio = (producto) => {
    const precioFormateado = producto.final_iva_incluido.toFixed(3)
    const textoCopiar = `${producto.sku} ${producto.descripcion} *$ ${precioFormateado}* Precio Final Iva Incluido`
    navigator.clipboard.writeText(textoCopiar).then(() => {
      console.log('Información del producto copiada:', textoCopiar)
      toast({
        title: "Éxito",
        description: "Información del producto copiada al portapapeles.",
      })
    }).catch(err => {
      console.error('Error al copiar: ', err)
      toast({
        title: "Error",
        description: "No se pudo copiar la información del producto.",
        variant: "destructive",
      })
    })
  }

  const handleDownloadExcel = (tipoEnvio) => {
    const envios = tipoEnvio === 'flex' ? enviosFlex : enviosMercadoLibre
    const worksheet = XLSX.utils.json_to_sheet(envios)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Envíos")
    XLSX.writeFile(workbook, `Envios_${tipoEnvio}.xlsx`)
    console.log(`Archivo Excel de envíos ${tipoEnvio} generado y descargado`)
  }

  const renderEnviosPorSemana = () => {
    console.log('Renderizando envíos por semana. Current tab:', currentTab)
    console.log('Estado de enviosPorSemana:', enviosPorSemana)

    const envios = enviosPorSemana[currentTab]
    const semanas = Object.keys(envios || {})
    
    if (semanas.length === 0) {
      return <p>No hay envíos para mostrar.</p>
    }

    const currentPage = currentTab === 'flex' ? currentPageFlex : currentPageML
    const semanaActual = semanas[currentPage]
    const semanaData = envios[semanaActual]

    if (!semanaData) {
      return <p>No hay datos para la semana seleccionada.</p>
    }

    const { envios: enviosSemana, costoTotal } = semanaData

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Semana:  {semanaActual}</span>
            <Button onClick={() => handleDownloadExcel(currentTab)} size="sm">
              <Download className="mr-2 h-4 w-4" /> Descargar Excel
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nro. Venta</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Estado</TableHead>
                {currentTab === 'ml' && (
                  <>
                    <TableHead>Costo</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Transporte</TableHead>
                    <TableHead>Adicional</TableHead>
                    <TableHead>Nro. Seguimiento</TableHead>
                  </>
                )}
                {currentTab === 'flex' && (
                  <>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Zona - Precio</TableHead>
                  </>
                )}
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enviosSemana.map((envio) => (
                <TableRow key={envio.id}>
                  <TableCell>{envio.nro_venta}</TableCell>
                  <TableCell>{envio.fecha}</TableCell>
                  <TableCell>{envio.producto || (currentTab === 'ml' ? envio.sku : 'N/A')}</TableCell>
                  <TableCell>{envio.estado}</TableCell>
                  {currentTab === 'ml' && (
                    <>
                      <TableCell>${envio.costo}</TableCell>
                      <TableCell>{envio.destinatario}</TableCell>
                      <TableCell>{envio.transporte || 'N/A'}</TableCell>
                      <TableCell>{envio.adicional || 'N/A'}</TableCell>
                      <TableCell>{envio.nro_seguimiento || 'N/A'}</TableCell>
                    </>
                  )}
                  {currentTab === 'flex' && (
                    <>
                      <TableCell>{envio.ubicacion}</TableCell>
                      <TableCell>{`${envio.zona} - $${envio.precio}`}</TableCell>
                    </>
                  )}
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Editar Estado</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Actualizar Estado del Envío</DialogTitle>
                        </DialogHeader>
                        <Select
                          onValueChange={(value) => 
                            handleUpdateEstado(envio.id, value, currentTab)
                          }
                          defaultValue={envio.estado}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione nuevo estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="enviado">Enviado</SelectItem>
                            <SelectItem value="entregado">Entregado</SelectItem>
                          </SelectContent>
                        </Select>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-between items-center">
            <p className="text-lg font-semibold">Costo Total de la Semana: ${costoTotal.toFixed(2)}</p>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => currentTab === 'flex' ? setCurrentPageFlex(0) : setCurrentPageML(0)}
                disabled={currentPage === 0}
                size="sm"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => currentTab === 'flex' 
                  ? setCurrentPageFlex(prev => Math.max(0, prev - 1))
                  : setCurrentPageML(prev => Math.max(0, prev - 1))
                }
                disabled={currentPage === 0}
                size="sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>{currentPage + 1} de {semanas.length}</span>
              <Button
                onClick={() => currentTab === 'flex'
                  ? setCurrentPageFlex(prev => Math.min(semanas.length - 1, prev + 1))
                  : setCurrentPageML(prev => Math.min(semanas.length - 1, prev + 1))
                }
                disabled={currentPage === semanas.length - 1}
                size="sm"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => currentTab === 'flex'
                  ? setCurrentPageFlex(semanas.length - 1)
                  : setCurrentPageML(semanas.length - 1)
                }
                disabled={currentPage === semanas.length - 1}
                size="sm"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const productosFiltrados = useMemo(() => {
    return productos.filter(producto =>
      producto.sku.toLowerCase().includes(filtroSKU.toLowerCase())
    )
  }, [productos, filtroSKU])

  const renderProductosEnDeposito = () => {
    console.log('Renderizando productos en depósito')
    console.log('Productos filtrados:', productosFiltrados)

    const totalPages = Math.ceil(productosFiltrados.length / productosPerPage)
    const paginatedProductos = productosFiltrados.slice(
      productosPage * productosPerPage,
      (productosPage + 1) * productosPerPage
    )

    return (
      <Card>
        <CardHeader>
          <CardTitle>Productos en el Depósito</CardTitle>
          <div className="mt-2">
            <Label htmlFor="filtroSKU">Buscar por SKU</Label>
            <Input
              id="filtroSKU"
              value={filtroSKU}
              onChange={(e) => {
                setFiltroSKU(e.target.value)
                setProductosPage(0)  // Reset to first page when filtering
              }}
              placeholder="Ingrese SKU"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Potencia</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Precio USD</TableHead>
                <TableHead>USD WP</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Final (IVA incluido)</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProductos.map((producto) => (
                <TableRow key={producto.id}>
                  <TableCell>{producto.sku}</TableCell>
                  <TableCell>{producto.potencia}</TableCell>
                  <TableCell>{producto.descripcion}</TableCell>
                  <TableCell>${producto.precio_usd?.toFixed(2) || 'N/A'}</TableCell>
                  <TableCell>${producto.usd_wp?.toFixed(2) || 'N/A'}</TableCell>
                  <TableCell>{producto.iva?.toFixed(3) || 'N/A'}</TableCell>
                  <TableCell>${producto.final_iva_incluido?.toFixed(2) || 'N/A'}</TableCell>
                  <TableCell>
                    <Button
                      onClick={() => handleCopyPrecio(producto)}
                      size="sm"
                    >
                      Copiar Precio
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Mostrando {paginatedProductos.length} de {productosFiltrados.length} productos
            </p>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setProductosPage(0)}
                disabled={productosPage === 0}
                size="sm"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setProductosPage(prev => Math.max(0, prev - 1))}
                disabled={productosPage === 0}
                size="sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>{productosPage + 1} de {totalPages}</span>
              <Button
                onClick={() => setProductosPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={productosPage === totalPages - 1}
                size="sm"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setProductosPage(totalPages - 1)}
                disabled={productosPage === totalPages - 1}
                size="sm"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return <div>Cargando...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Gestión de Envíos y Productos</h1>
      
      <Tabs defaultValue="flex" className="mb-6" onValueChange={setCurrentTab}>
        <TabsList>
          <TabsTrigger value="flex">Envíos Flex</TabsTrigger>
          <TabsTrigger value="ml">Envíos Mercado Libre</TabsTrigger>
          <TabsTrigger value="productos">Productos en Depósito</TabsTrigger>
        </TabsList>
        
        <TabsContent value="flex">
          <form onSubmit={handleSubmitFlex} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fecha">Fecha</Label>
                <Input type="date" id="fecha" name="fecha" required />
              </div>
              <div>
                <Label htmlFor="nro_venta">Nro. de Venta</Label>
                <Input type="text" id="nro_venta" name="nro_venta" required />
              </div>
              <div>
                <Label htmlFor="producto">Producto</Label>
                <Input type="text" id="producto" name="producto" required  />
              </div>
              <div>
                <Label htmlFor="estado">Estado</Label>
                <Select name="estado" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="entregado">Entregado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ubicacion">Ubicación</Label>
                <Input type="text" id="ubicacion" name="ubicacion" required />
              </div>
              <div>
                <Label htmlFor="zona">Zona</Label>
                <Select name="zona" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione zona" />
                  </SelectTrigger>
                  <SelectContent>
                    {zonas.map((zona) => (
                      <SelectItem key={zona.nombre} value={zona.nombre}>
                        {zona.nombre} - ${zona.precio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit">Agregar Envío Flex</Button>
          </form>
          {renderEnviosPorSemana()}
        </TabsContent>
        
        <TabsContent value="ml">
          <form onSubmit={handleSubmitML} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fecha-ml">Fecha</Label>
                <Input type="date" id="fecha-ml" name="fecha" required />
              </div>
              <div>
                <Label htmlFor="nro_venta-ml">Nro. de Venta</Label>
                <Input type="text" id="nro_venta-ml" name="nro_venta" required />
              </div>
              <div>
                <Label htmlFor="sku-ml">SKU</Label>
                <Input type="text" id="sku-ml" name="sku" required />
              </div>
              <div>
                <Label htmlFor="costo-ml">Costo</Label>
                <Input type="number" id="costo-ml" name="costo" required />
              </div>
              <div>
                <Label htmlFor="destinatario-ml">Destinatario</Label>
                <Input type="text" id="destinatario-ml" name="destinatario" required />
              </div>
              <div>
                <Label htmlFor="estado-ml">Estado</Label>
                <Select name="estado" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="entregado">Entregado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cantidad-ml">Cantidad</Label>
                <Input type="number" id="cantidad-ml" name="cantidad" required />
              </div>
              <div>
                <Label htmlFor="cantidad_paneles-ml">Cantidad de Paneles</Label>
                <Input type="number" id="cantidad_paneles-ml" name="cantidad_paneles" required />
              </div>
              <div>
                <Label htmlFor="transporte-ml">Transporte</Label>
                <Input type="text" id="transporte-ml" name="transporte" />
              </div>
              <div>
                <Label htmlFor="adicional-ml">Adicional</Label>
                <Input type="text" id="adicional-ml" name="adicional" />
              </div>
              <div>
                <Label htmlFor="nro_seguimiento-ml">Nro. de Seguimiento</Label>
                <Input type="text" id="nro_seguimiento-ml" name="nro_seguimiento" />
              </div>
            </div>
            <Button type="submit">Agregar Envío Mercado Libre</Button>
          </form>
          {renderEnviosPorSemana()}
        </TabsContent>

        <TabsContent value="productos">
          {renderProductosEnDeposito()}
        </TabsContent>
      </Tabs>
    </div>
  )
}