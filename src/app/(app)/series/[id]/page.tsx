export default function SeriesDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Series Detail</h1>
      <p className="text-gray-500">Series ID: {params.id}</p>
    </div>
  )
}
