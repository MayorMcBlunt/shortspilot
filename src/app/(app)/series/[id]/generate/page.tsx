export default function GeneratePage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Generate Content</h1>
      <p className="text-gray-500">AI generation for series: {params.id}</p>
    </div>
  )
}
